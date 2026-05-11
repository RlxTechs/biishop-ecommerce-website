const state = { data: null, products: [], categories: [], selectedId: null, query: '' };
const $ = (id) => document.getElementById(id);
const form = $('productForm');

function money(v){ const n=Number(v||0); return n ? new Intl.NumberFormat('fr-FR').format(n)+' F' : 'Sur demande'; }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); }
function placeholder(label='Bi_Shop'){ const safe=encodeURIComponent(label.slice(0,18)); return `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' rx='45' fill='%23eaf4f8'/%3E%3Ctext x='150' y='160' text-anchor='middle' font-family='Arial' font-size='30' font-weight='800' fill='%23065b84'%3E${safe}%3C/text%3E%3C/svg%3E`; }
function resolveImagePath(path){ if(!path) return ''; const p=String(path).trim(); if(p.startsWith('data:')||p.startsWith('http://')||p.startsWith('https://')||p.startsWith('/')) return p; if(p.startsWith('./static/')) return '/' + p.slice(2); if(p.startsWith('static/')) return '/' + p; return p; }
function imageOf(p){ return resolveImagePath((Array.isArray(p.gallery)&&p.gallery[0]) || p.defaultImage || ''); }
function priceOf(p){ return Number(p.basePrice || (p.variants && p.variants[0] && p.variants[0].price) || 0); }
function slugify(s){ return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80) || 'produit-'+Date.now(); }
function escapeHtml(v){ return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

async function api(url, options={}){
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers||{}) }, ...options });
  const data = await res.json().catch(()=>({ok:false,error:'Réponse invalide'}));
  if(!res.ok || data.ok === false) throw new Error(data.error || 'Erreur serveur');
  return data;
}

async function load(){
  state.data = await api('/admin/api/data');
  state.products = state.data.products || [];
  state.categories = state.data.categories || [];
  if(!state.categories.find(c=>c.id==='all')) state.categories.unshift({id:'all', name:'Tout'});
  state.selectedId = state.products[0]?.id || null;
  render();
}

function render(){
  $('statProducts').textContent = state.products.length;
  $('statCategories').textContent = state.categories.length;
  $('statWhatsapp').textContent = state.data.meta?.whatsapp || '—';
  renderCategorySelect();
  renderList();
  renderCategoriesText();
  renderSettings();
  if(state.selectedId) fillForm(state.products.find(p=>p.id===state.selectedId));
  else newProduct();
}

function renderCategorySelect(){
  const select = $('categorySelect');
  select.innerHTML = state.categories.filter(c=>c.id !== 'all').map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
}

function renderList(){
  const q = state.query.toLowerCase();
  const list = state.products.filter(p => [p.title,p.subtitle,p.tag,p.categoryId].filter(Boolean).join(' ').toLowerCase().includes(q));
  $('productList').innerHTML = list.map(p=>`<button type="button" class="product-row ${p.id===state.selectedId?'active':''}" data-id="${escapeHtml(p.id)}">
    <div class="thumb"><img src="${escapeHtml(imageOf(p)||placeholder(p.title))}" onerror="this.onerror=null;this.src='${placeholder('Bi_Shop')}'" alt="" /></div>
    <div><b>${escapeHtml(p.title||'Produit')}</b><span>${escapeHtml(p.categoryId||'')} · ${escapeHtml(p.availability||'')}</span></div>
    <small>${money(priceOf(p))}</small>
  </button>`).join('');
  $('productList').querySelectorAll('button').forEach(btn=>btn.onclick=()=>{ state.selectedId=btn.dataset.id; renderList(); fillForm(state.products.find(p=>p.id===state.selectedId)); });
}

function renderCategoriesText(){
  $('categoriesText').value = state.categories.map(c=>`${c.id} | ${c.name}`).join('\n');
}

function renderSettings(){
  const meta = state.data.meta || {};
  const f = $('settingsForm');
  ['project','city','whatsapp','phone','currency','currencySymbol'].forEach(k => { if(f.elements[k]) f.elements[k].value = meta[k] || (k==='project'?'Bi_Shop':''); });
}

function fillForm(p){
  if(!p){ newProduct(); return; }
  $('formTitle').textContent = 'Modifier produit';
  form.elements.id.value = p.id || '';
  form.elements.title.value = p.title || '';
  form.elements.subtitle.value = p.subtitle || '';
  form.elements.categoryId.value = p.categoryId || state.categories.find(c=>c.id!=='all')?.id || 'tech';
  form.elements.tag.value = p.tag || '';
  form.elements.basePrice.value = p.basePrice || '';
  form.elements.availability.value = p.availability || 'Disponible';
  form.elements.description.value = p.description || '';
  form.elements.hot.checked = Boolean(p.hot);
  form.elements.isNew.checked = Boolean(p.isNew);
  form.elements.defaultImage.value = p.defaultImage || '';
  form.elements.gallery.value = Array.isArray(p.gallery) ? p.gallery.join('\n') : '';
  form.elements.variants.value = JSON.stringify(p.variants || [], null, 2);
  updatePreview();
}

function readForm(){
  let variants = [];
  try { variants = JSON.parse(form.elements.variants.value || '[]'); }
  catch(e){ throw new Error('Les variantes ne sont pas en JSON valide. Exemple: [{"name":"32 pouces","price":60000,"images":[]}]'); }
  if(!Array.isArray(variants)) throw new Error('Les variantes doivent être un tableau JSON [].');
  const title = form.elements.title.value.trim();
  const id = slugify(form.elements.id.value || title);
  return {
    id,
    title,
    subtitle: form.elements.subtitle.value.trim(),
    categoryId: form.elements.categoryId.value,
    tag: form.elements.tag.value.trim() || 'Bi_Shop',
    availability: form.elements.availability.value.trim() || 'Disponible',
    basePrice: Number(form.elements.basePrice.value || 0),
    description: form.elements.description.value.trim(),
    hot: form.elements.hot.checked,
    isNew: form.elements.isNew.checked,
    defaultImage: form.elements.defaultImage.value.trim(),
    gallery: form.elements.gallery.value.split('\n').map(x=>x.trim()).filter(Boolean),
    variants,
    updatedAt: Math.floor(Date.now()/1000)
  };
}

function newProduct(){
  state.selectedId = null;
  $('formTitle').textContent = 'Nouveau produit';
  form.reset();
  form.elements.categoryId.value = state.categories.find(c=>c.id!=='all')?.id || 'tech';
  form.elements.availability.value = 'Disponible';
  form.elements.variants.value = '[]';
  updatePreview();
}

function updatePreview(){
  const src = resolveImagePath(form.elements.defaultImage.value.trim()) || placeholder(form.elements.title.value || 'Bi_Shop');
  $('previewImage').src = src;
  $('previewImage').onerror = () => { $('previewImage').onerror=null; $('previewImage').src = placeholder('Bi_Shop'); };
}

async function saveProduct(ev){
  ev?.preventDefault();
  try{
    const product = readForm();
    const res = await api('/admin/api/product', { method:'POST', body: JSON.stringify(product) });
    const idx = state.products.findIndex(p=>p.id===res.product.id);
    if(idx>=0) state.products[idx]=res.product; else state.products.unshift(res.product);
    state.selectedId = res.product.id;
    $('saveStatus').textContent = 'Sauvé à '+new Date().toLocaleTimeString('fr-FR');
    render(); toast('Produit sauvegardé ✅');
  }catch(e){ toast(e.message); }
}

async function saveAll(){
  try{ state.data.products = state.products; state.data.categories = state.categories; await api('/admin/api/data', {method:'POST', body: JSON.stringify(state.data)}); toast('Catalogue complet sauvegardé ✅'); }
  catch(e){ toast(e.message); }
}

async function deleteProduct(){
  if(!state.selectedId) return toast('Aucun produit sélectionné');
  if(!confirm('Supprimer ce produit ?')) return;
  try{
    await api('/admin/api/product/'+encodeURIComponent(state.selectedId), {method:'DELETE'});
    state.products = state.products.filter(p=>p.id!==state.selectedId);
    state.selectedId = state.products[0]?.id || null;
    render(); toast('Produit supprimé');
  }catch(e){ toast(e.message); }
}

function duplicateProduct(){
  const p = state.products.find(x=>x.id===state.selectedId);
  if(!p) return;
  const copy = JSON.parse(JSON.stringify(p));
  copy.id = slugify(copy.id + '-copie-' + Date.now().toString().slice(-4));
  copy.title = (copy.title || 'Produit') + ' copie';
  state.products.unshift(copy);
  state.selectedId = copy.id;
  render(); toast('Produit dupliqué, pense à sauvegarder.');
}

async function uploadImage(){
  const input = $('imageUpload');
  if(!input.files.length) return toast('Choisis une image d’abord.');
  const fd = new FormData();
  fd.append('file', input.files[0]);
  fd.append('product_id', form.elements.id.value || slugify(form.elements.title.value || 'produit'));
  try{
    const res = await fetch('/admin/api/upload', { method:'POST', body: fd });
    const data = await res.json();
    if(!res.ok || !data.ok) throw new Error(data.error || 'Upload impossible');

    // L'API renvoie maintenant un chemin absolu /static/assets/products/...
    // donc l'image marche dans l'admin ET sur le site client.
    form.elements.defaultImage.value = data.path;
    const currentGallery = form.elements.gallery.value.split('\n').map(x=>x.trim()).filter(Boolean);
    if(!currentGallery.includes(data.path)) currentGallery.unshift(data.path);
    form.elements.gallery.value = currentGallery.join('\n');
    updatePreview();

    // Si le produit a déjà un nom, on sauvegarde automatiquement pour éviter
    // le piège: “j'ai uploadé mais je n'ai pas cliqué sur Sauvegarder”.
    if(form.elements.title.value.trim()){
      await saveProduct();
      toast('Image copiée dans assets et produit sauvegardé ✅');
    }else{
      toast('Image copiée. Ajoute le nom du produit puis sauvegarde.');
    }
  }catch(e){ toast(e.message); }
}

function applyCategories(){
  const lines = $('categoriesText').value.split('\n').map(x=>x.trim()).filter(Boolean);
  const cats = [];
  for(const line of lines){
    const [idRaw, ...nameParts] = line.split('|');
    const id = (idRaw || '').trim();
    const name = (nameParts.join('|') || idRaw || '').trim();
    if(id && name) cats.push({id, name});
  }
  if(!cats.find(c=>c.id==='all')) cats.unshift({id:'all', name:'Tout'});
  state.categories = cats;
  state.data.categories = cats;
  renderCategorySelect();
  renderList();
  toast('Catégories appliquées. Clique “Sauvegarder tout”.');
}

function saveSettings(ev){
  ev.preventDefault();
  const fd = new FormData(ev.target);
  state.data.meta = state.data.meta || {};
  for(const [k,v] of fd.entries()) state.data.meta[k] = v;
  state.data.meta.project = 'Bi_Shop';
  saveAll();
}

function bind(){
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
    btn.classList.add('active'); $(btn.dataset.panel).classList.add('show');
  });
  $('newProductBtn').onclick = newProduct;
  $('saveAllBtn').onclick = saveAll;
  $('backupBtn').onclick = async()=>{ try{ await api('/admin/api/backup',{method:'POST'}); toast('Backup créé ✅'); }catch(e){toast(e.message)} };
  $('productSearch').oninput = (e)=>{ state.query=e.target.value; renderList(); };
  form.onsubmit = saveProduct;
  $('deleteBtn').onclick = deleteProduct;
  $('duplicateBtn').onclick = duplicateProduct;
  $('uploadBtn').onclick = uploadImage;
  form.elements.defaultImage.addEventListener('input', updatePreview);
  form.elements.title.addEventListener('input', () => { if(!form.elements.id.value) form.elements.id.value = slugify(form.elements.title.value); updatePreview(); });
  $('applyCategoriesBtn').onclick = applyCategories;
  $('settingsForm').onsubmit = saveSettings;
}

bind();
load().catch(e=>toast(e.message));
