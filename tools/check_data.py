import json
from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'data' / 'products.json'
data = json.loads(p.read_text(encoding='utf-8'))
print('Projet:', data.get('meta', {}).get('project'))
print('Produits:', len(data.get('products', [])))
print('Categories:', len(data.get('categories', [])))
print('WhatsApp:', data.get('meta', {}).get('whatsapp'))
