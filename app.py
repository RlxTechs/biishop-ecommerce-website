from __future__ import annotations

import json
import os
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Dict

from flask import Flask, jsonify, redirect, render_template, request, send_from_directory, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_FILE = DATA_DIR / "products.json"
BACKUP_DIR = DATA_DIR / "backups"
ASSETS_DIR = BASE_DIR / "static" / "assets" / "products"
LEGACY_ASSETS_DIR = BASE_DIR / "assets" / "products"

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif", "svg"}
MAX_UPLOAD_MB = 12

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = os.environ.get("BI_SHOP_SECRET_KEY", "bi-shop-dev-secret-change-me")
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

# Password simple pour usage local. En production: mettre BI_SHOP_ADMIN_PASSWORD dans les variables d'environnement.
ADMIN_PASSWORD = os.environ.get("BI_SHOP_ADMIN_PASSWORD", "admin123")
ADMIN_PASSWORD_HASH = os.environ.get("BI_SHOP_ADMIN_PASSWORD_HASH") or generate_password_hash(ADMIN_PASSWORD)


def read_data() -> Dict[str, Any]:
    if not DATA_FILE.exists():
        return {
            "meta": {
                "schema": "bi_shop.products.v1",
                "project": "Bi_Shop",
                "city": "Brazzaville",
                "currency": "XAF",
                "currencySymbol": "F",
                "whatsapp": "+242050541963",
                "phone": "+242066518669",
                "updatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            },
            "categories": [{"id": "all", "name": "Tout"}],
            "products": [],
        }
    with DATA_FILE.open("r", encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("meta", {})
    data.setdefault("categories", [])
    data.setdefault("products", [])
    data["meta"]["project"] = "Bi_Shop"
    data["products"] = [normalize_product_images(p) for p in data.get("products", [])]
    return data


def write_data(data: Dict[str, Any], make_backup: bool = True) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    if make_backup and DATA_FILE.exists():
        stamp = time.strftime("%Y%m%d-%H%M%S")
        shutil.copy2(DATA_FILE, BACKUP_DIR / f"products-{stamp}.json")
    data.setdefault("meta", {})
    data["products"] = [normalize_product_images(p) for p in data.get("products", [])]
    data["meta"]["project"] = "Bi_Shop"
    data["meta"]["updatedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
    tmp = DATA_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(DATA_FILE)


def slugify(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9A-ZÀ-ÿ]+", "-", value, flags=re.UNICODE).strip("-")
    value = value.encode("ascii", "ignore").decode("ascii") or f"item-{uuid.uuid4().hex[:8]}"
    return value[:80]


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def public_asset_path(filename: str) -> str:
    # Chemin absolu depuis la racine du site. Fonctionne dans l'admin (/admin) et sur le site (/).
    return f"/static/assets/products/{filename}"


def normalize_image_path(path: str) -> str:
    # Corrige les anciens chemins relatifs qui pouvaient casser dans /admin.
    if not path:
        return ""
    path = str(path).strip()
    if path.startswith("./static/"):
        return "/" + path[2:]
    if path.startswith("static/"):
        return "/" + path
    return path


def normalize_product_images(product: Dict[str, Any]) -> Dict[str, Any]:
    product["defaultImage"] = normalize_image_path(product.get("defaultImage", ""))
    product["gallery"] = [normalize_image_path(x) for x in product.get("gallery", []) if x]
    for variant in product.get("variants", []) or []:
        if isinstance(variant, dict):
            variant["image"] = normalize_image_path(variant.get("image", ""))
            variant["images"] = [normalize_image_path(x) for x in variant.get("images", []) if x]
    return product


def require_login():
    return bool(session.get("bi_shop_admin"))


@app.context_processor
def inject_globals():
    return {"store_name": "Bi_Shop"}


@app.route("/")
def storefront():
    return send_from_directory(BASE_DIR, "index.html")



@app.route("/assets/<path:filename>")
def legacy_assets(filename: str):
    # Compatibilité avec les anciens chemins ./assets/... du fichier products.json.
    # On vérifie aussi static/assets pour que les images uploadées restent faciles à retrouver.
    for folder in (BASE_DIR / "assets", BASE_DIR / "static" / "assets"):
        candidate = folder / filename
        if candidate.exists() and candidate.is_file():
            return send_from_directory(folder, filename)
    return "", 404

@app.route("/data/products.json")
def products_json():
    return send_from_directory(DATA_DIR, "products.json")


@app.route("/api/data")
def api_data():
    return jsonify(read_data())


@app.route("/health")
def health():
    data = read_data()
    return jsonify({"ok": True, "products": len(data.get("products", [])), "categories": len(data.get("categories", []))})


@app.route("/admin/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        password = request.form.get("password", "")
        if check_password_hash(ADMIN_PASSWORD_HASH, password):
            session["bi_shop_admin"] = True
            return redirect(url_for("admin"))
        error = "Mot de passe incorrect."
    return render_template("login.html", error=error)


@app.route("/admin/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/admin")
def admin():
    if not require_login():
        return redirect(url_for("login"))
    return render_template("admin.html")


@app.route("/admin/api/data", methods=["GET"])
def admin_get_data():
    if not require_login():
        return jsonify({"ok": False, "error": "Non autorisé"}), 401
    return jsonify(read_data())


@app.route("/admin/api/data", methods=["POST"])
def admin_save_data():
    if not require_login():
        return jsonify({"ok": False, "error": "Non autorisé"}), 401
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"ok": False, "error": "JSON invalide"}), 400
    payload.setdefault("categories", [])
    payload.setdefault("products", [])
    write_data(payload)
    return jsonify({"ok": True, "message": "Catalogue sauvegardé."})


@app.route("/admin/api/product", methods=["POST"])
def admin_upsert_product():
    if not require_login():
        return jsonify({"ok": False, "error": "Non autorisé"}), 401
    product = request.get_json(silent=True) or {}
    if not product.get("title"):
        return jsonify({"ok": False, "error": "Le nom du produit est obligatoire."}), 400
    product_id = product.get("id") or slugify(product.get("title"))
    product["id"] = slugify(product_id)
    product.setdefault("categoryId", "tech")
    product.setdefault("tag", "Bi_Shop")
    product.setdefault("availability", "Disponible")
    product.setdefault("basePrice", 0)
    product.setdefault("gallery", [])
    product.setdefault("variants", [])
    product = normalize_product_images(product)
    product["updatedAt"] = int(time.time())

    data = read_data()
    products = data.get("products", [])
    index = next((i for i, p in enumerate(products) if p.get("id") == product["id"]), None)
    if index is None:
        products.insert(0, product)
    else:
        products[index] = product
    data["products"] = products
    write_data(data)
    return jsonify({"ok": True, "product": product})


@app.route("/admin/api/product/<product_id>", methods=["DELETE"])
def admin_delete_product(product_id: str):
    if not require_login():
        return jsonify({"ok": False, "error": "Non autorisé"}), 401
    data = read_data()
    old_count = len(data.get("products", []))
    data["products"] = [p for p in data.get("products", []) if p.get("id") != product_id]
    write_data(data)
    return jsonify({"ok": True, "deleted": old_count - len(data.get("products", []))})


@app.route("/admin/api/upload", methods=["POST"])
def admin_upload():
    if not require_login():
        return jsonify({"ok": False, "error": "Non autorisé"}), 401
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"ok": False, "error": "Aucun fichier image reçu."}), 400
    if not allowed_file(file.filename):
        return jsonify({"ok": False, "error": "Format non accepté. Utilise png, jpg, jpeg, webp, gif ou svg."}), 400

    # L'image est réellement COPIÉE dans le projet ici :
    # 1) static/assets/products/  => affichage immédiat sur le site et dans l'admin
    # 2) assets/products/         => compatibilité/export si tu réutilises des anciens chemins ./assets/...
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    LEGACY_ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    clean = secure_filename(file.filename)
    stem, ext = os.path.splitext(clean)
    filename = f"{slugify(stem)}-{uuid.uuid4().hex[:8]}{ext.lower()}"
    dest = ASSETS_DIR / filename
    file.save(dest)

    legacy_dest = LEGACY_ASSETS_DIR / filename
    try:
        shutil.copy2(dest, legacy_dest)
    except Exception:
        # Si la copie legacy échoue, l'image principale reste quand même disponible via /static.
        pass

    web_path = public_asset_path(filename)
    return jsonify({
        "ok": True,
        "path": web_path,
        "static_path": web_path,
        "legacy_path": f"/assets/products/{filename}",
        "message": "Image copiée dans static/assets/products et liée au produit."
    })


@app.route("/admin/api/backup", methods=["POST"])
def admin_backup():
    if not require_login():
        return jsonify({"ok": False, "error": "Non autorisé"}), 401
    data = read_data()
    write_data(data, make_backup=True)
    return jsonify({"ok": True, "message": "Backup créé dans data/backups."})


@app.route("/admin/api/backups", methods=["GET"])
def admin_backups():
    if not require_login():
        return jsonify({"ok": False, "error": "Non autorisé"}), 401
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    items = sorted([p.name for p in BACKUP_DIR.glob("*.json")], reverse=True)[:30]
    return jsonify({"ok": True, "backups": items})


if __name__ == "__main__":
    host = os.environ.get("BI_SHOP_HOST", "127.0.0.1")
    port = int(os.environ.get("BI_SHOP_PORT", "5050"))
    print("\nBi_Shop est lancé.")
    print(f"Site client : http://{host}:{port}/")
    print(f"Admin      : http://{host}:{port}/admin")
    print("Mot de passe admin par défaut : admin123")
    print("Change-le avec la variable BI_SHOP_ADMIN_PASSWORD.\n")
    app.run(host=host, port=port, debug=True)
