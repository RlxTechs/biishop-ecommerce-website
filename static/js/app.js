const state = {
  data: null,
  products: [],
  categories: [],
  activeCategory: 'all',
  search: '',
  sort: 'featured',
  cart: JSON.parse(localStorage.getItem('bi_shop_cart') || '[]'),
  orderAddress: localStorage.getItem('bi_shop_order_address') || '',
  orderNotes: localStorage.getItem('bi_shop_order_notes') || '',
  foodDeliveryArea: localStorage.getItem('bi_shop_food_delivery_area') || 'near',
  current: null,
  selectedVariant: null,
  selectedImageIndex: 0,
  dropIndex: 0,
  dropTimer: null,
  dropTick: null,
  progressStartedAt: Date.now(),
  theme: localStorage.getItem('bi_shop_theme') || 'light',
  logoEmojiIndex: 0,
};

const $ = (id) => document.getElementById(id);
const els = {
  topbar: $('topbar'), themeToggle: $('themeToggle'), themeIcon: $('themeIcon'), themeLabel: $('themeLabel'), brandPop: $('brandPop'), showcaseStage: $('showcaseStage'), dropThumbs: $('dropThumbs'), dropProgress: $('dropProgress'),
  prevDrop: $('prevDrop'), nextDrop: $('nextDrop'), heroBuyBtn: $('heroBuyBtn'),
  categoryStrip: $('categoryStrip'), productsGrid: $('productsGrid'), hotProducts: $('hotProducts'),
  searchInput: $('searchInput'), clearSearch: $('clearSearch'), sortSelect: $('sortSelect'),
  productStats: $('productStats'), emptyState: $('emptyState'), catalogueEyebrow: $('catalogueEyebrow'), catalogueTitle: $('catalogueTitle'),
  cartCount: $('cartCount'), cartDrawer: $('cartDrawer'), cartItems: $('cartItems'), cartSubtotal: $('cartSubtotal'), cartDelivery: $('cartDelivery'), cartTotal: $('cartTotal'),
  orderAddress: $('orderAddress'), orderNotes: $('orderNotes'), deliveryBox: $('deliveryBox'), foodDeliveryArea: $('foodDeliveryArea'), deliveryNote: $('deliveryNote'),
  productModal: $('productModal'), toast: $('toast'), confettiLayer: $('confettiLayer'), backTop: $('backTop'),
};

const categoryEmoji = { all:'✨', tech:'💻', food:'🍔', mobilite:'🛵', energie:'⚡', services:'🛠️', tv:'📺', refrigerateur:'🧊', split:'❄️', congelateur:'🧊', iphones:'📱', Papeterie:'📚', papeterie:'📚' };
const featureCategories = new Set(['iphones','tv','tech','refrigerateur','congelateur','split','energie','mobilite']);

const logoEmojis = ['🛒','🎮','💻','📱','📺','⚡'];
function applyTheme() {
  const theme = state.theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = theme;
  localStorage.setItem('bi_shop_theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#070815' : '#f7fbff');
  if (els.themeIcon) els.themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
  if (els.themeLabel) els.themeLabel.textContent = theme === 'dark' ? 'Sombre' : 'Clair';
  if (els.themeToggle) els.themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
}
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
}
function startLogoPulse() {
  if (!els.brandPop) return;
  els.brandPop.textContent = logoEmojis[state.logoEmojiIndex % logoEmojis.length];
  setInterval(() => {
    state.logoEmojiIndex = (state.logoEmojiIndex + 1) % logoEmojis.length;
    els.brandPop.textContent = logoEmojis[state.logoEmojiIndex];
  }, 1400);
}

function money(value) {
  const num = Number(value || 0);
  if (!num) return 'Prix sur demande';
  return new Intl.NumberFormat('fr-FR').format(num) + ' F';
}
function cleanPhone(phone) { return String(phone || '+242050541963').replace(/[^0-9]/g, ''); }
function variantsOf(product) { return Array.isArray(product?.variants) ? product.variants.filter(v => v && Number(v.price || 0) >= 0) : []; }
function hasVariants(product) { return variantsOf(product).length > 0; }
function priceOf(product, variant = null) { return Number((variant && variant.price) || product?.basePrice || 0); }
function pricesOf(product) {
  const variants = variantsOf(product);
  const vals = variants.length ? variants.map(v => Number(v.price || 0)).filter(Boolean) : [Number(product?.basePrice || 0)].filter(Boolean);
  return vals;
}
function priceLabel(product, variant = null) {
  if (variant) return money(priceOf(product, variant));
  const vals = pricesOf(product);
  if (!vals.length) return 'Prix sur demande';
  const min = Math.min(...vals), max = Math.max(...vals);
  if (hasVariants(product)) return min === max ? money(min) : `À partir de ${money(min)}`;
  return money(min);
}
function resolveImagePath(path) {
  if (!path) return '';
  const p = String(path).trim();
  if (p.startsWith('data:') || p.startsWith('http://') || p.startsWith('https://') || p.startsWith('/')) return p;
  if (p.startsWith('./static/')) return '/' + p.slice(2);
  if (p.startsWith('static/')) return '/' + p;
  return p;
}
function imageCandidates(product, variant = null) {
  const list = [];
  if (variant) {
    if (Array.isArray(variant.images)) list.push(...variant.images);
    if (variant.image) list.push(variant.image);
  }
  if (Array.isArray(product?.gallery)) list.push(...product.gallery);
  if (product?.defaultImage) list.push(product.defaultImage);
  return [...new Set(list.filter(Boolean).map(resolveImagePath))];
}
function imageOf(product, variant = null, index = 0) {
  const list = imageCandidates(product, variant);
  return list[index] || list[0] || '';
}
function placeholder(label = 'Bi_Shop') {
  const safe = encodeURIComponent(String(label).slice(0, 20));
  return `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 720'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%230a0e25'/%3E%3Cstop offset='.45' stop-color='%23065b84'/%3E%3Cstop offset='1' stop-color='%23ffd166'/%3E%3C/linearGradient%3E%3Cfilter id='s'%3E%3CfeDropShadow dx='0' dy='18' stdDeviation='20' flood-opacity='.35'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='720' height='720' rx='80' fill='url(%23g)'/%3E%3Ccircle cx='360' cy='300' r='155' fill='white' opacity='.10'/%3E%3Crect x='190' y='210' width='340' height='270' rx='48' fill='white' opacity='.16' filter='url(%23s)'/%3E%3Ctext x='360' y='585' text-anchor='middle' font-family='Arial' font-size='46' font-weight='900' fill='white'%3E${safe}%3C/text%3E%3C/svg%3E`;
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value); }
function hashString(value) { return String(value || '').split('').reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0); }
function urgencyMeta(product) {
  const seed = Math.abs(hashString(product?.id || product?.title || 'bi'));
  return { viewers: 9 + (seed % 42), stockLeft: 2 + (seed % 8), soldToday: 7 + (seed % 31), rarity: ['HOT DROP','RARE DEAL','FAST SALE','BEST PICK'][seed % 4] };
}
function isFood(product) {
  const txt = `${product?.categoryId || ''} ${product?.tag || ''} ${product?.title || ''}`.toLowerCase();
  return txt.includes('food') || txt.includes('riz') || txt.includes('poulet') || txt.includes('saka') || txt.includes('banane') || txt.includes('chawarma');
}
function saveCart() { localStorage.setItem('bi_shop_cart', JSON.stringify(state.cart)); updateCartUI(); }
function saveOrderFields() {
  state.orderAddress = (els.orderAddress?.value || '').trim();
  state.orderNotes = (els.orderNotes?.value || '').trim();
  state.foodDeliveryArea = els.foodDeliveryArea?.value || state.foodDeliveryArea || 'near';
  localStorage.setItem('bi_shop_order_address', state.orderAddress);
  localStorage.setItem('bi_shop_order_notes', state.orderNotes);
  localStorage.setItem('bi_shop_food_delivery_area', state.foodDeliveryArea);
}
function syncOrderFields() {
  if (els.orderAddress) els.orderAddress.value = state.orderAddress;
  if (els.orderNotes) els.orderNotes.value = state.orderNotes;
  if (els.foodDeliveryArea) els.foodDeliveryArea.value = state.foodDeliveryArea;
}

async function loadData() {
  const sources = ['./data/products.json', '/api/data'];
  let lastError = null;
  for (const src of sources) {
    try {
      const res = await fetch(src + '?v=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error(src + ' ' + res.status);
      state.data = await res.json();
      break;
    } catch (err) { lastError = err; }
  }
  if (!state.data) throw lastError || new Error('Catalogue introuvable');
  state.data.meta = state.data.meta || {};
  state.data.meta.project = 'Bi_Shop';
  state.products = Array.isArray(state.data.products) ? state.data.products : [];
  state.categories = Array.isArray(state.data.categories) ? state.data.categories : [];
  if (!state.categories.some(c => c.id === 'all')) state.categories.unshift({ id: 'all', name: 'Tout' });
  renderAll();
}
function renderAll() {
  renderCategories();
  renderShowcase();
  renderHot();
  renderProducts();
  updateCartUI();
  syncOrderFields();
  startDropAutoPlay();
}
function scoreProduct(p) {
  let s = 0;
  if (p.hot) s += 80;
  if (p.isNew) s += 45;
  if (featureCategories.has(p.categoryId)) s += 25;
  if (imageOf(p)) s += 20;
  if (priceOf(p) || pricesOf(p).length) s += 10;
  if (/iphone|tv|laptop|ordinateur|play|congel|réfrig|refriger|split|groupe/i.test(`${p.title} ${p.subtitle}`)) s += 25;
  return s;
}
function featuredProducts() {
  const list = [...state.products].filter(p => p && p.title).sort((a,b) => scoreProduct(b) - scoreProduct(a));
  return list.slice(0, Math.min(10, list.length));
}
function currentDrop() { const drops = featuredProducts(); return drops[state.dropIndex % Math.max(1, drops.length)]; }
function renderShowcase() {
  const drops = featuredProducts();
  if (!drops.length) {
    els.showcaseStage.innerHTML = `<div class="drop-card active"><div class="drop-info"><h2>Bi_Shop Drops</h2><p>Ajoute des produits depuis l’admin pour les afficher ici.</p></div></div>`;
    return;
  }
  state.dropIndex = Math.max(0, Math.min(state.dropIndex, drops.length - 1));
  const current = drops[state.dropIndex];
  const prev = drops[(state.dropIndex - 1 + drops.length) % drops.length];
  const next = drops[(state.dropIndex + 1) % drops.length];
  const layout = [
    {p: prev, cls: 'side prev'}, {p: current, cls: 'active'}, {p: next, cls: 'side next'}
  ];
  els.showcaseStage.innerHTML = layout.map(({p, cls}) => dropCard(p, cls)).join('');
  els.dropThumbs.innerHTML = drops.map((p, i) => `<button class="drop-thumb ${i === state.dropIndex ? 'active' : ''}" data-drop="${i}"><img src="${escapeAttr(imageOf(p) || placeholder(p.title))}" alt="${escapeAttr(p.title)}" onerror="this.onerror=null;this.src='${placeholder('Bi_Shop')}'"/><span>${escapeHtml(shortTitle(p.title))}</span></button>`).join('');
  els.dropThumbs.querySelectorAll('[data-drop]').forEach(btn => btn.addEventListener('click', () => { state.dropIndex = Number(btn.dataset.drop); resetDropProgress(); renderShowcase(); }));
  els.showcaseStage.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', (ev) => { ev.stopPropagation(); openProduct(btn.dataset.open); }));
  els.showcaseStage.querySelectorAll('[data-buy]').forEach(btn => btn.addEventListener('click', (ev) => { ev.stopPropagation(); quickBuy(btn.dataset.buy); }));
  els.showcaseStage.querySelectorAll('.drop-card').forEach(card => card.addEventListener('click', () => openProduct(card.dataset.id)));
  resetDropProgress();
}
function dropCard(product, cls) {
  const meta = urgencyMeta(product);
  const img = imageOf(product) || placeholder(product.title || 'Bi_Shop');
  const oldPrice = priceOf(product) ? money(Math.round(priceOf(product) * 1.14)) : '';
  return `<article class="drop-card ${cls}" data-id="${escapeAttr(product.id)}">
    <div class="drop-bg-orb"></div>
    <div class="drop-media"><img src="${escapeAttr(img)}" alt="${escapeAttr(product.title || 'Produit')}" onerror="this.onerror=null;this.src='${placeholder('Bi_Shop')}'"/></div>
    <div class="drop-info">
      <div class="rarity">${escapeHtml(meta.rarity)}</div>
      <h2>${escapeHtml(product.title || 'Produit')}</h2>
      <p>${escapeHtml(product.subtitle || product.availability || 'Disponible')}</p>
      <div class="drop-price"><strong>${priceLabel(product)}</strong>${oldPrice ? `<span>${oldPrice}</span>` : ''}</div>
      <div class="urgency-grid">
        <span>👀 ${meta.viewers} regardent</span><span>📦 ${meta.stockLeft} en stock promo</span><span>🔥 ${meta.soldToday}+ demandés</span>
      </div>
      <div class="drop-actions"><button class="primary" data-buy="${escapeAttr(product.id)}">Acheter vite</button><button class="ghost" data-open="${escapeAttr(product.id)}">Détails</button></div>
    </div>
  </article>`;
}
function nextDrop() { const drops = featuredProducts(); if (!drops.length) return; state.dropIndex = (state.dropIndex + 1) % drops.length; renderShowcase(); }
function prevDrop() { const drops = featuredProducts(); if (!drops.length) return; state.dropIndex = (state.dropIndex - 1 + drops.length) % drops.length; renderShowcase(); }
function startDropAutoPlay() {
  if (state.dropTimer) clearInterval(state.dropTimer);
  state.dropTimer = setInterval(nextDrop, 5200);
  if (state.dropTick) clearInterval(state.dropTick);
  state.dropTick = setInterval(updateDropProgress, 80);
  resetDropProgress();
}
function resetDropProgress() { state.progressStartedAt = Date.now(); updateDropProgress(); }
function updateDropProgress() {
  if (!els.dropProgress) return;
  const pct = Math.min(100, ((Date.now() - state.progressStartedAt) / 5200) * 100);
  els.dropProgress.style.width = pct + '%';
}
function shortTitle(title) { return String(title || '').replace(/\s*\(.+?\)/g,'').slice(0, 18); }

function renderCategories() {
  els.categoryStrip.innerHTML = state.categories.map(cat => {
    const active = cat.id === state.activeCategory ? 'active' : '';
    const emoji = categoryEmoji[cat.id] || '🛒';
    return `<button class="cat-chip ${active}" data-cat="${escapeHtml(cat.id)}"><span>${emoji}</span><b>${escapeHtml(cat.name)}</b></button>`;
  }).join('');
  els.categoryStrip.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
    state.activeCategory = btn.dataset.cat;
    renderCategories(); renderProducts();
    $('catalogueSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}
function filteredProducts() {
  const q = state.search.trim().toLowerCase();
  let list = [...state.products];
  if (state.activeCategory !== 'all') list = list.filter(p => p.categoryId === state.activeCategory);
  if (q) list = list.filter(p => [p.title, p.subtitle, p.tag, p.categoryId, p.description, ...variantsOf(p).map(v => v.name)].filter(Boolean).join(' ').toLowerCase().includes(q));
  if (state.sort === 'price-asc') list.sort((a,b) => Math.min(...(pricesOf(a).length ? pricesOf(a) : [0])) - Math.min(...(pricesOf(b).length ? pricesOf(b) : [0])));
  if (state.sort === 'price-desc') list.sort((a,b) => Math.max(...(pricesOf(b).length ? pricesOf(b) : [0])) - Math.max(...(pricesOf(a).length ? pricesOf(a) : [0])));
  if (state.sort === 'name') list.sort((a,b) => String(a.title).localeCompare(String(b.title), 'fr'));
  if (state.sort === 'featured') list.sort((a,b) => scoreProduct(b) - scoreProduct(a));
  return list;
}
function renderHot() {
  const hot = featuredProducts().slice(0, 12);
  els.hotProducts.innerHTML = hot.map(productCard).join('');
  attachProductEvents(els.hotProducts);
}
function renderProducts() {
  const list = filteredProducts();
  els.productStats.textContent = `${list.length} article${list.length > 1 ? 's' : ''}`;
  els.emptyState.hidden = Boolean(list.length);
  els.catalogueEyebrow.textContent = state.search ? 'Résultats rapides' : 'Catalogue';
  els.catalogueTitle.textContent = state.search ? `Recherche : “${state.search.trim()}”` : (state.activeCategory === 'all' ? 'Tous les articles' : (state.categories.find(c => c.id === state.activeCategory)?.name || 'Articles'));
  els.productsGrid.innerHTML = list.map(productCard).join('');
  attachProductEvents(els.productsGrid);
}
function productCard(product) {
  const meta = urgencyMeta(product);
  const badge = product.hot ? 'HOT' : (product.isNew ? 'NEW' : (product.availability || 'Disponible'));
  return `<article class="product-card" data-id="${escapeAttr(product.id)}">
    <div class="product-image"><img loading="lazy" src="${escapeAttr(imageOf(product) || placeholder(product.title || 'Bi_Shop'))}" alt="${escapeAttr(product.title || 'Produit')}" onerror="this.onerror=null;this.src='${placeholder('Bi_Shop')}'"/><div class="badge-row"><span class="badge">${escapeHtml(badge)}</span><span class="watch">👀 ${meta.viewers}</span></div></div>
    <div class="product-info"><div class="product-tag">${escapeHtml(product.tag || 'Bi_Shop')}</div><div class="product-title">${escapeHtml(product.title || 'Produit')}</div><div class="product-sub">${escapeHtml(product.subtitle || product.availability || 'Disponible')}</div><div class="product-bottom"><span class="price">${priceLabel(product)}</span><button class="mini-add" data-add="${escapeAttr(product.id)}" aria-label="Ajouter ou choisir">${hasVariants(product) ? 'Choisir' : '+'}</button></div></div>
  </article>`;
}
function attachProductEvents(root) {
  root.querySelectorAll('.product-card').forEach(card => card.addEventListener('click', (ev) => { if (ev.target.closest('[data-add]')) return; openProduct(card.dataset.id); }));
  root.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', (ev) => { ev.stopPropagation(); quickBuy(btn.dataset.add); }));
}
function quickBuy(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  if (hasVariants(p)) { openProduct(id, true); return; }
  addToCart(p, null);
}
function openProduct(id, forceChoose = false) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  state.current = product;
  state.selectedVariant = hasVariants(product) ? null : null;
  state.selectedImageIndex = 0;
  renderProductDetail(forceChoose);
  els.productModal.classList.add('show');
  els.productModal.setAttribute('aria-hidden', 'false');
}
function closeModal() { els.productModal.classList.remove('show'); els.productModal.setAttribute('aria-hidden','true'); }
function renderProductDetail(forceChoose = false) {
  const p = state.current;
  const v = state.selectedVariant;
  const images = imageCandidates(p, v);
  const image = images[state.selectedImageIndex] || images[0] || '';
  $('detailImage').src = image || placeholder(p.title || 'Bi_Shop');
  $('detailImage').alt = p.title || 'Produit';
  $('detailImage').onerror = () => { $('detailImage').onerror = null; $('detailImage').src = placeholder(p.title || 'Bi_Shop'); };
  $('detailTag').textContent = p.tag || 'Bi_Shop';
  $('detailAvailability').textContent = p.availability || 'Disponible';
  $('detailTitle').textContent = p.title || 'Produit';
  $('detailSubtitle').textContent = p.subtitle || '';
  $('detailPrice').textContent = priceLabel(p, v);
  $('detailOldPrice').textContent = priceOf(p, v) ? money(Math.round(priceOf(p, v) * 1.14)) : '';
  $('detailDescription').textContent = p.description || 'Contacte-nous pour plus de détails, disponibilité et livraison.';
  const variantBlock = $('variantBlock');
  const variantList = $('variantList');
  if (hasVariants(p)) {
    variantBlock.hidden = false;
    variantBlock.classList.toggle('attention', Boolean(forceChoose));
    variantList.innerHTML = variantsOf(p).map((item, idx) => `<button class="variant-btn ${item === v ? 'active' : ''}" data-variant="${idx}">${escapeHtml(item.name || 'Option')} · ${money(item.price)}</button>`).join('');
    variantList.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => { state.selectedVariant = variantsOf(p)[Number(btn.dataset.variant)]; state.selectedImageIndex = 0; renderProductDetail(false); }));
  } else { variantBlock.hidden = true; variantList.innerHTML = ''; }
  const dots = $('imageDots');
  dots.innerHTML = images.slice(0, 8).map((_, idx) => `<button class="${idx === state.selectedImageIndex ? 'active' : ''}" data-image="${idx}" aria-label="Image ${idx + 1}"></button>`).join('');
  dots.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => { state.selectedImageIndex = Number(btn.dataset.image); renderProductDetail(false); }));
}
function addToCart(product, variant = null) {
  if (!product) return;
  if (hasVariants(product) && !variant) { showToast('Choisis d’abord une option.'); renderProductDetail(true); $('variantBlock')?.classList.add('shake'); setTimeout(() => $('variantBlock')?.classList.remove('shake'), 500); return; }
  const key = product.id + '::' + (variant?.name || 'standard');
  const existing = state.cart.find(item => item.key === key);
  if (existing) existing.qty += 1;
  else state.cart.push({ key, id: product.id, title: product.title, categoryId: product.categoryId, tag: product.tag, variant: variant?.name || '', price: priceOf(product, variant), image: imageOf(product, variant), isFood: isFood(product), qty: 1 });
  saveCart(); burstConfetti(); showToast('Ajouté au panier ✨');
  if (els.productModal.classList.contains('show')) closeModal();
}
function cartSubtotal() { return state.cart.reduce((sum, item) => sum + item.qty * Number(item.price || 0), 0); }
function cartHasFood() { return state.cart.some(item => item.isFood); }
function deliveryFee() { if (!cartHasFood()) return 0; return state.foodDeliveryArea === 'far' ? 800 : 500; }
function updateCartUI() {
  const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
  els.cartCount.textContent = count;
  const subtotal = cartSubtotal();
  const fee = deliveryFee();
  els.cartSubtotal.textContent = money(subtotal);
  els.cartDelivery.textContent = cartHasFood() ? (state.foodDeliveryArea === 'far' ? 'À partir de 800 F' : '500 F') : 'Gratuite';
  els.cartTotal.textContent = money(subtotal + fee);
  els.deliveryBox.hidden = !cartHasFood();
  els.deliveryNote.textContent = cartHasFood() ? 'Nourriture : 500F si Moungali/proche, sinon à partir de 800F et peut augmenter selon la distance.' : 'Livraison gratuite pour les articles hors nourriture.';
  if (!state.cart.length) { els.cartItems.innerHTML = `<div class="empty-state"><h3>Panier vide</h3><p>Ajoute un drop ou un article pour commander sur WhatsApp.</p></div>`; return; }
  els.cartItems.innerHTML = state.cart.map(item => `<div class="cart-item"><div class="cart-thumb"><img src="${escapeAttr(resolveImagePath(item.image) || placeholder(item.title))}" alt="" onerror="this.onerror=null;this.src='${placeholder('Bi_Shop')}'"/></div><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.variant || 'Standard')} · ${money(item.price)}</p></div><div class="qty"><button data-dec="${escapeAttr(item.key)}">−</button><span>${item.qty}</span><button data-inc="${escapeAttr(item.key)}">+</button></div></div>`).join('');
  els.cartItems.querySelectorAll('[data-inc]').forEach(btn => btn.onclick = () => { const item = state.cart.find(x => x.key === btn.dataset.inc); if (item) item.qty++; saveCart(); });
  els.cartItems.querySelectorAll('[data-dec]').forEach(btn => btn.onclick = () => { const item = state.cart.find(x => x.key === btn.dataset.dec); if (!item) return; item.qty--; if (item.qty <= 0) state.cart = state.cart.filter(x => x.key !== item.key); saveCart(); });
}
function openCart() { els.cartDrawer.classList.add('show'); els.cartDrawer.setAttribute('aria-hidden','false'); }
function closeCart() { els.cartDrawer.classList.remove('show'); els.cartDrawer.setAttribute('aria-hidden','true'); }
function whatsappMessage(product = null, variant = null) {
  if (product) return `Bonjour Bi_Shop, je suis intéressé par : ${product.title}${variant?.name ? ' - ' + variant.name : ''} (${priceLabel(product, variant)}). Est-ce disponible ?`;
  if (!state.cart.length) return 'Bonjour Bi_Shop, je veux voir vos articles disponibles.';
  saveOrderFields();
  const lines = state.cart.map((item, i) => `${i + 1}. ${item.title}${item.variant ? ' - ' + item.variant : ''} x${item.qty} = ${money(item.price * item.qty)}`);
  const subtotal = cartSubtotal();
  const hasFood = cartHasFood();
  const delivery = hasFood ? (state.foodDeliveryArea === 'far' ? 'Nourriture : à partir de 800F, à confirmer selon distance' : 'Nourriture : 500F Moungali/proche') : 'Gratuite hors nourriture';
  const totalLine = hasFood ? `Total estimé : ${money(subtotal + deliveryFee())}` : `Total estimé : ${money(subtotal)}`;
  const notes = state.orderNotes ? `\nNotes : ${state.orderNotes}` : '';
  return `Bonjour Bi_Shop, je veux commander depuis le site :\n${lines.join('\n')}\nSous-total : ${money(subtotal)}\nLivraison : ${delivery}\n${totalLine}\nAdresse/zone : ${state.orderAddress}${notes}`;
}
function checkoutCart() {
  if (!state.cart.length) return openWhatsApp(whatsappMessage());
  saveOrderFields();
  if (!state.orderAddress) { openCart(); els.orderAddress?.classList.add('field-error'); els.orderAddress?.focus(); showToast('Renseigne ton adresse ou ta zone.'); return; }
  els.orderAddress?.classList.remove('field-error'); openWhatsApp(whatsappMessage());
}
function openWhatsApp(message) { const phone = cleanPhone(state.data?.meta?.whatsapp || '+242050541963'); window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank'); }
function showToast(message) { if (!els.toast) return; els.toast.textContent = message; els.toast.classList.add('show'); clearTimeout(showToast.t); showToast.t = setTimeout(() => els.toast.classList.remove('show'), 1800); }
function burstConfetti() {
  const root = els.confettiLayer; if (!root) return;
  const count = 20;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.style.left = (20 + Math.random() * 60) + 'vw';
    p.style.setProperty('--x', ((Math.random() - .5) * 220) + 'px');
    p.style.setProperty('--r', (Math.random() * 540 - 270) + 'deg');
    p.style.animationDelay = (Math.random() * .08) + 's';
    root.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}
function bindUI() {
  applyTheme();
  startLogoPulse();
  els.themeToggle?.addEventListener('click', toggleTheme);
  els.prevDrop.onclick = () => { prevDrop(); startDropAutoPlay(); };
  els.nextDrop.onclick = () => { nextDrop(); startDropAutoPlay(); };
  els.heroBuyBtn.onclick = () => { const p = currentDrop(); if (p) quickBuy(p.id); };
  els.searchInput.addEventListener('input', () => {
    state.search = els.searchInput.value; state.activeCategory = 'all'; renderCategories(); renderProducts();
    if (state.search.trim()) setTimeout(() => $('catalogueSection').scrollIntoView({ behavior:'smooth', block:'start' }), 60);
  });
  els.clearSearch.addEventListener('click', () => { els.searchInput.value = ''; state.search = ''; renderProducts(); });
  els.sortSelect.addEventListener('change', () => { state.sort = els.sortSelect.value; renderProducts(); });
  $('openCart').onclick = openCart; $('navCart').onclick = openCart; $('closeCart').onclick = closeCart;
  els.cartDrawer.addEventListener('click', ev => { if (ev.target === els.cartDrawer) closeCart(); });
  $('checkoutBtn').onclick = checkoutCart;
  els.orderAddress?.addEventListener('input', () => { els.orderAddress.classList.remove('field-error'); saveOrderFields(); });
  els.orderNotes?.addEventListener('input', saveOrderFields);
  els.foodDeliveryArea?.addEventListener('change', () => { saveOrderFields(); updateCartUI(); });
  $('closeModal').onclick = closeModal;
  els.productModal.addEventListener('click', ev => { if (ev.target === els.productModal) closeModal(); });
  $('detailAddCart').onclick = () => addToCart(state.current, state.selectedVariant);
  $('detailWhatsApp').onclick = () => openWhatsApp(whatsappMessage(state.current, state.selectedVariant));
  document.querySelectorAll('[data-scroll]').forEach(btn => btn.addEventListener('click', () => { const target = btn.dataset.scroll === 'top' ? document.body : $(btn.dataset.scroll); target?.scrollIntoView({ behavior:'smooth', block:'start' }); }));
  window.addEventListener('scroll', () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    els.backTop.classList.toggle('show', y > 700);
    els.topbar.classList.toggle('scrolled', y > 30);
  }, { passive: true });
  els.backTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
}

bindUI();
loadData().catch(err => { console.error(err); els.productsGrid.innerHTML = `<div class="empty-state"><h3>Catalogue introuvable</h3><p>Vérifie le fichier data/products.json.</p></div>`; });
