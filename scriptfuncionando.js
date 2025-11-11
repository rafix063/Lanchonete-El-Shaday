/* script.js — lógica do carrinho e painel (BroadcastChannel + localStorage fallback) */

/*
Data flow:
- Produtos são carregados de /data/produtos.json (fetch). Se fetch falhar (file://),
  usamos produtosEmbebed (fallback).

- ✅ CORREÇÃO: Carrinho do cliente é salvo em localStorage.el_shaday_drafts_v1 (objeto) A CADA ALTERAÇÃO
- ✅ CORREÇÃO: Admin é notificado instantaneamente via BroadcastChannel ('drafts_updated') a cada alteração no carrinho (rascunho).

- Pedido criado no cliente -> salvo em localStorage.orders (array) -> notificado via BroadcastChannel ('orders_updated')
- Admin recebe notificação e atualiza lista em tempo real
- Status do pedido alterado no admin -> salva em localStorage e notifica
*/

const CHANNEL_NAME = 'el_shaday_channel_v1';
const bcSupported = ('BroadcastChannel' in window);
const bc = bcSupported ? new BroadcastChannel(CHANNEL_NAME) : null;

const LS_ORDERS_KEY = 'el_shaday_orders_v1';
const LS_PRODUCTS_KEY = 'el_shaday_products_v1';

// ✅ NOVAS CHAVES PARA RASCUNHOS (DRAFTS)
const LS_DRAFTS_KEY = 'el_shaday_drafts_v1'; 
const DRAFT_ID_KEY = 'el_shaday_client_id_v1'; 

// fallback products (used se fetch falhar)
const produtosEmbedded = {
  "nome_loja":"El Shaday Lanchonete",
  "categorias":[
    {"nome":"Pastéis","itens":[
      {"id":"p1","nome":"Pastel de Queijo","preco":12.00},
      {"id":"p2","nome":"Pastel de Carne","preco":14.00}
    ]},
    {"nome":"Lanches","itens":[
      {"id":"l1","nome":"Misto","preco":7.00},
      {"id":"l2","nome":"X-Egg","preco":10.00},
      {"id":"l3","nome":"X-Salada","preco":12.00},
      {"id":"l4","nome":"X-Bacon","preco":15.00}
    ]},
    {"nome":"Bebidas","itens":[
      {"id":"b1","nome":"Água 500ml","preco":6.00},
      {"id":"b2","nome":"Refrigerante 350ml","preco":8.00},
      {"id":"b3","nome":"Suco natural","preco":10.00}
    ]}
  ]
};

/* --- utilidades --- */

// ✅ NOVO: Garante que esta aba tenha um ID único para o rascunho
function getClientId(){
    let id = localStorage.getItem(DRAFT_ID_KEY);
    if (!id) {
        id = uid('client'); // Reusa a função uid existente
        localStorage.setItem(DRAFT_ID_KEY, id);
    }
    return id;
}

function readOrders(){
  try{
    const raw = localStorage.getItem(LS_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function writeOrders(orders){
  localStorage.setItem(LS_ORDERS_KEY, JSON.stringify(orders));
  notifyChannel({type:'orders_updated'});
}

// ✅ NOVO: Funções para ler e escrever rascunhos
function readDrafts(){
    try{
        const raw = localStorage.getItem(LS_DRAFTS_KEY);
        return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
}
function writeDrafts(drafts, type = 'drafts_updated'){
    localStorage.setItem(LS_DRAFTS_KEY, JSON.stringify(drafts));
    notifyChannel({type:type}); 
}

function notifyChannel(msg){
  try{
    if(bc) bc.postMessage(msg);
    // fallback: write to special ls key to trigger storage event in other tabs
    localStorage.setItem('__el_shaday_msg', JSON.stringify({msg, t:Date.now()}));
  }catch(e){ console.warn('notify error', e); }
}
function uid(prefix='id'){
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}
function formatMoney(v){ return 'R$ ' + v.toFixed(2).replace('.',','); }

/* --- carregar produtos --- */
async function loadProducts(){
  // primeiro: tente fetch /data/produtos.json
  try{
    const resp = await fetch('data/produtos.json', {cache: "no-store"});
    if(resp.ok){
      const data = await resp.json();
      localStorage.setItem(LS_PRODUCTS_KEY, JSON.stringify(data));
      return data;
    } else throw new Error('fetch não ok');
  }catch(e){
    // fallback para embedded ou se já estiver no localStorage
    const raw = localStorage.getItem(LS_PRODUCTS_KEY);
    if(raw){
      try{ return JSON.parse(raw); } catch(err) {}
    }
    return produtosEmbedded;
  }
}

/* --- cliente: index.html --- */
async function mountClient(){
  const data = await loadProducts();
  document.title = data.nome_loja + ' — Cardápio';
  document.getElementById('shop-name').innerText = data.nome_loja;
  const menu = document.getElementById('menu');
  menu.innerHTML = '';

  data.categorias.forEach(cat=>{
    const catEl = document.createElement('div');
    catEl.className='category';
    catEl.innerHTML = `<h3>${cat.nome}</h3><div class="items"></div>`;
    const itemsWrap = catEl.querySelector('.items');
    cat.itens.forEach(it=>{
      const itEl = document.createElement('div');
      itEl.className='item';
      itEl.innerHTML = `
        <div class="left">
          <div class="name">${it.nome}</div>
          <div class="price">${formatMoney(it.preco)}</div>
        </div>
        <div class="right flex">
          <button class="btn small" data-add="${it.id}">Adicionar</button>
        </div>
      `;
      itemsWrap.appendChild(itEl);
    });
    menu.appendChild(catEl);
  });

 // eventos add
  menu.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('button[data-add]');
    if(!btn) return;
    const id = btn.getAttribute('data-add');
    addToCartById(id);
  });

  // carregar carrinho inicial
  renderCart();
}

/* --- carrinho --- */
function getCatalog(){
  const raw = localStorage.getItem(LS_PRODUCTS_KEY);
  if(raw) try{ return JSON.parse(raw);}catch(e){}
  return produtosEmbedded;
}
function findProductById(id){
  const cat = getCatalog().categorias;
  for(const c of cat){
    for(const it of c.itens) if(it.id === id) return it;
  }
  return null;
}

function getCart(){
  try{
    const raw = localStorage.getItem('el_shaday_cart_v1');
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}

// ✅ MODIFICADO: Salva o rascunho e notifica o admin a cada alteração no carrinho.
function saveCart(cart){ 
    localStorage.setItem('el_shaday_cart_v1', JSON.stringify(cart)); 
    renderCart(); 
    saveAndBroadcastDraft(cart); // << AQUI ESTÁ A CORREÇÃO
}

// ✅ NOVO: Salva o rascunho atual do carrinho no localStorage e notifica
function saveAndBroadcastDraft(cart){
    const clientId = getClientId();
    let drafts = readDrafts();
    const cartKeys = Object.keys(cart);
    
    if (cartKeys.length > 0) {
        // Cria/Atualiza o rascunho
        const items = Object.values(cart).map(i=>({id:i.id, nome:i.nome, preco:i.preco, q:i.q}));
        drafts[clientId] = {
            id: clientId,
            timestamp: Date.now(),
            customer: document.getElementById('customer-name')?.value || document.getElementById('customer-name-mobile')?.value || 'Cliente',
            items: items,
            total: calcCartTotal(cart)
        };
    } else {
        // Remove o rascunho se o carrinho estiver vazio
        delete drafts[clientId];
    }
    writeDrafts(drafts); // Salva em LS e notifica o admin
}


function addToCartById(id){
  const prod = findProductById(id);
  if(!prod) return alert('Produto não encontrado');
  const cart = getCart();
  if(cart[id]) cart[id].q++;
  else cart[id] = {id:prod.id, nome:prod.nome, preco:prod.preco, q:1};
  saveCart(cart); // saveCart agora notifica o admin
}

function changeQty(id, delta){
  const cart = getCart();
  if(!cart[id]) return;
  cart[id].q += delta;
  if(cart[id].q <= 0) delete cart[id];
  saveCart(cart); // saveCart agora notifica o admin
}

// ✅ MODIFICADO: Adiciona shouldBroadcastDraft para controle na função sendOrder
function clearCart(shouldBroadcastDraft = true){
  localStorage.removeItem('el_shaday_cart_v1');
  renderCart();
  if (shouldBroadcastDraft) { 
        saveAndBroadcastDraft({}); // Notifica que este rascunho foi limpo
  }
}

function calcCartTotal(cart){
  let total = 0;
  for(const k in cart) total += cart[k].preco * cart[k].q;
  return total;
}

function renderCart(){
  const cartWrap = document.getElementById('cart-items');
  if(!cartWrap) return;
  const cart = getCart();
  cartWrap.innerHTML = '';
  const keys = Object.keys(cart);
  if(keys.length === 0){
    cartWrap.innerHTML = `<div class="muted">Carrinho vazio</div>`;
    document.getElementById('cart-total').innerText = formatMoney(0);
    return;
  }
  keys.forEach(k=>{
    const it = cart[k];
    const el = document.createElement('div');
    el.className='cart-item';
    el.innerHTML = `
      <div>
        <div style="font-weight:600">${it.nome}</div>
        <div class="muted">${formatMoney(it.preco)} x ${it.q} = ${formatMoney(it.preco * it.q)}</div>
      </div>
      <div class="flex">
        <div class="qty">
          <button data-dec="${it.id}">-</button>
          <div>${it.q}</div>
          <button data-inc="${it.id}">+</button>
        </div>
      </div>
    `;
    cartWrap.appendChild(el);
  });

  document.getElementById('cart-total').innerText = formatMoney(calcCartTotal(cart));

  cartWrap.querySelectorAll('button[data-inc]').forEach(b=>{
    b.addEventListener('click', ()=> changeQty(b.getAttribute('data-inc'), +1));
  });
  cartWrap.querySelectorAll('button[data-dec]').forEach(b=>{
    b.addEventListener('click', ()=> changeQty(b.getAttribute('data-dec'), -1));
  });
}

/* --- enviar pedido --- */
function sendOrder(customerName = '') {
  const cart = getCart();
  if(Object.keys(cart).length === 0) return alert('Carrinho vazio.');
  const items = Object.values(cart).map(i=>({id:i.id, nome:i.nome, preco:i.preco, q:i.q}));
  const total = calcCartTotal(cart);
  const order = {
    id: uid('order'),
    created_at: new Date().toISOString(),
    customer: customerName || 'Cliente presencial',
    items,
    total,
    status: 'novo'
  };
  const orders = readOrders();
  orders.unshift(order);
  writeOrders(orders);
  
  clearCart(false); 
  alert('Pedido enviado! ID: ' + order.id);
}

/* --- admin --- */
function isCompletedPanel() {
  return window.location.pathname.includes('pedidos-concluidos.html');
}

window.deleteOrder = (orderId) => {
  if (!confirm('Tem certeza que deseja EXCLUIR este pedido?')) return;
  const allOrders = readOrders();
  const updatedOrders = allOrders.filter(order => order.id !== orderId);
  writeOrders(updatedOrders);
  renderOrders();
}

window.handleChangeOrderStatus = (orderId, newStatus) => {
  const orders = readOrders();
  const idx = orders.findIndex(o=>o.id === orderId);
  if(idx === -1) return alert('Pedido não encontrado');
  
  let mapped = 'novo';
  if(newStatus === 'em_preparo') mapped = 'em_preparo';
  if(newStatus === 'pronto') mapped = 'pronto';
  if(newStatus === 'concluido') mapped = 'concluido';
  
  orders[idx].status = mapped;
  writeOrders(orders);
  renderOrders();
}

function mountAdmin(){
  const shopName = document.getElementById('shop-name-admin');
  const dataRaw = localStorage.getItem(LS_PRODUCTS_KEY);
  const data = dataRaw ? JSON.parse(dataRaw) : produtosEmbedded;
  if(shopName) shopName.innerText = data.nome_loja || 'El Shaday Lanchonete';
  
  renderDrafts(); 
  renderOrders();
}

function renderOrders(){
  const wrap = document.getElementById('orders-wrap');
  if(!wrap) return;
  
  const isConcluido = isCompletedPanel(); 
  let orders = readOrders().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); 
  const ordersToDisplay = orders.filter(o => isConcluido ? o.status==='concluido' : o.status!=='concluido');
  
  if(ordersToDisplay.length === 0){ 
    wrap.innerHTML = `<div class="muted" style="margin:20px 0;">${isConcluido ? 'Nenhum pedido foi concluído ainda.' : 'Nenhum pedido pendente.'}</div>`; 
    return; 
  }

  wrap.innerHTML = '';
  ordersToDisplay.forEach(o=>{
    const div = document.createElement('div');
    div.className = 'order';
    
    let statusText = 'Novo';
    let statusClass = 'status-em-preparo'; 
    if(o.status === 'em_preparo') { statusText = 'Em preparo'; statusClass = 'status-pronto'; }
    if(o.status === 'pronto') { statusText = 'Pronto'; statusClass = 'status-pronto'; }
    if(o.status === 'concluido') { statusText = 'Concluído'; statusClass = 'status-concluido'; }
    
    const statusBadge = `<span class="badge status ${statusClass}">${statusText}</span>`;

    let actionButtons = '';
    if (isConcluido) {
        actionButtons = `<button class="btn" style="background:var(--danger);" onclick="deleteOrder('${o.id}')">Excluir</button>`;
    } else {
        if (o.status === 'novo') {
             actionButtons = `<button class="btn" data-action="em_preparo" data-id="${o.id}">Em preparo</button>`;
        } else if (o.status === 'em_preparo') {
             actionButtons = `<button class="btn" data-action="pronto" data-id="${o.id}">Pronto</button>`;
        } else if (o.status === 'pronto') {
             actionButtons = `<button class="btn" data-action="concluido" data-id="${o.id}" style="background:var(--success)">Concluído</button>`;
        }
    }

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <h4>${o.customer} <small class="muted">• ${new Date(o.created_at).toLocaleString()}</small></h4>
          <div class="muted">ID: ${o.id.substring(6)}</div>
        </div>
        <div>${statusBadge}</div>
      </div>

      <div style="margin-top:8px">
        ${ o.items.map(it=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #f0f0f0">
          <div>${it.nome} x ${it.q}</div>
          <div class="muted">${formatMoney(it.preco * it.q)}</div>
        </div>`).join('') }
      </div>

      <div class="total-row" style="margin-top:8px">
        <div>Total</div>
        <div style="font-weight:800">${formatMoney(o.total)}</div>
      </div>

      <div style="margin-top:10px;display:flex;gap:8px">
        ${actionButtons}
      </div>
    `;
    wrap.appendChild(div);
  });

  wrap.querySelectorAll('button[data-action]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = b.getAttribute('data-id');
      const action = b.getAttribute('data-action');
      handleChangeOrderStatus(id, action);
    });
  });
}

// ✅ NOVO: Renderiza a lista de rascunhos no admin.html
function renderDrafts(){
    const draftsWrap = document.getElementById('drafts-wrap');
    if(!draftsWrap) return;

    const drafts = readDrafts();
    const activeDrafts = Object.values(drafts).sort((a, b) => b.timestamp - a.timestamp); 
    
    draftsWrap.innerHTML = '';

    if (activeDrafts.length === 0) {
        draftsWrap.innerHTML = '<div class="muted" style="margin:20px 0;">Nenhum rascunho de pedido ativo.</div>';
    } else {
        activeDrafts.forEach(draft => {
            const div = document.createElement('div');
            div.className = 'order draft-order';
            div.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <h4>RASCUNHO - ${draft.customer} <small class="muted">• ${new Date(draft.timestamp).toLocaleTimeString()}</small></h4>
                        <div class="muted">Cliente: ${draft.id.substring(6)}</div>
                    </div>
                    <div><span class="badge status status-novo" style="background:#007bff; color:#fff;">Em Andamento</span></div>
                </div>

                <div style="margin-top:8px;border-bottom:1px dashed #f0f0f0;padding-bottom:8px;">
                    ${ draft.items.map(it=>`<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;">
                        <div>${it.nome} x ${it.q}</div>
                        <div class="muted">${formatMoney(it.preco * it.q)}</div>
                    </div>`).join('') }
                </div>

                <div class="total-row" style="margin-top:8px">
                    <div>Total Estimado</div>
                    <div style="font-weight:800">${formatMoney(draft.total)}</div>
                </div>

                <div style="margin-top:10px;display:flex;gap:8px;font-size:14px;" class="muted">
                    Aguardando cliente enviar o pedido...
                </div>
            `;
            draftsWrap.appendChild(div);
        });
    }
}

/* --- listeners para sincronização --- */
if(bc){
  bc.onmessage = (ev)=> {
    if(ev.data && (ev.data.type === 'orders_updated' || ev.data.type === 'ping')) renderOrders();
    if(ev.data && ev.data.type === 'drafts_updated') renderDrafts();
  };
}

// storage event fallback (triggers on other tabs)
window.addEventListener('storage', (ev)=>{
  if(ev.key === '__el_shaday_msg'){
    try{
      const payload = JSON.parse(ev.newValue);
      const msg = payload.msg;
      if(msg && (msg.type === 'orders_updated' || msg.type === 'ping')) renderOrders();
    }catch(e){}
  }
  if(ev.key === LS_DRAFTS_KEY) renderDrafts(); 
});

/* --- inicialização condicional (cliente vs admin) --- */
document.addEventListener('DOMContentLoaded', ()=>{
  if(document.getElementById('menu')) mountClient();
  if(document.getElementById('orders-wrap')) mountAdmin(); 

  const sendBtn = document.getElementById('send-order-btn');
  if(sendBtn){
    sendBtn.addEventListener('click', ()=>{
      const customer = document.getElementById('customer-name')?.value || 'Cliente';
      sendOrder(customer);
    });
  }

  const clearBtn = document.getElementById('clear-cart-btn');
  if(clearBtn) clearBtn.addEventListener('click', clearCart);

  if(bc) bc.postMessage({type:'ping'});
  localStorage.setItem('__el_shaday_msg', JSON.stringify({msg:{type:'ping'}, t:Date.now()}));
});
