/* script.js — lógica do carrinho e painel (BroadcastChannel + localStorage fallback) */

/*
Data flow:
- Produtos são carregados de /data/produtos.json (fetch). Se fetch falhar (file://),
  usamos produtosEmbebed (fallback).
- Pedido criado no cliente -> salvo em localStorage.orders (array) -> notificado via BroadcastChannel
- Admin recebe notificação e atualiza lista em tempo real
- Status do pedido alterado no admin -> salva em localStorage e notifica
*/

const CHANNEL_NAME = 'el_shaday_channel_v1';
const bcSupported = ('BroadcastChannel' in window);
const bc = bcSupported ? new BroadcastChannel(CHANNEL_NAME) : null;

const LS_ORDERS_KEY = 'el_shaday_orders_v1';
const LS_PRODUCTS_KEY = 'el_shaday_products_v1';
const LS_CART_KEY = 'el_shaday_cart_v1'; // Adicionado para consistência

const LS_DRAFTS_KEY = 'el_shaday_drafts_v1'; // Novo: Rascunhos de pedidos (carrinhos ativos)
const DRAFT_ID_KEY = 'el_shaday_client_id_v1'; // Novo: ID único para identificar o cliente (aba) no rascunho

// fallback products (used se fetch falhar)
const produtosEmbedded = {
    "nome_loja":"El Shaday Lanchonete",
    "categorias":[
        {"nome":"Pastéis","itens":[
            {"id":"p1","nome":"Pastel Grande (G)","preco":12.00,"descricaoDetalhada":"Sabores: Queijo, Carne, Frango, Pizza, Calabresa com queijo. Adicionais: Bacon (+R$3), Ovo (+R$2)."}, 
            {"id":"p2","nome":"Pastel de Carne","preco":14.00}
        ]},
        {"nome":"Lanches","itens":[
            {"id":"l1","nome":"Misto","preco":7.00},
            {"id":"l2","nome":"X-Egg","preco":10.00},
            {"id":"l3","nome":"X-Bacon","preco":14.00}
        ]},
        {"nome":"Bebidas","itens":[
            {"id":"b1","nome":"Coca-Cola Lata","preco":6.00},
            {"id":"b2","nome":"Água Mineral","preco":3.00}
        ]}
    ]
};

/* --- utils --- */

function formatMoney(value){
    return new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(value);
}

function generateOrderId(){
    const date = new Date();
    const timestamp = date.getTime();
    const random = Math.floor(Math.random() * 900) + 100; // 3-digit random number
    return `${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}-${timestamp.toString().slice(-4)}${random}`;
}

function uid(prefix = ''){
    return prefix + Math.random().toString(36).substring(2, 9);
}

/* --- Mecanismo de Notificação Unificado --- */

/**
 * Envia uma mensagem para o BroadcastChannel ou usa o localStorage como fallback
 * para notificar outras abas sobre uma atualização.
 * @param {object} msg - O objeto de mensagem (ex: {type: 'orders_updated'})
 */
function notifyChannel(msg){
    try{
        if(bc) bc.postMessage(msg);
        // Fallback usando localStorage: salva o objeto de mensagem em uma chave temporária
        // com timestamp para garantir que o evento 'storage' seja disparado.
        localStorage.setItem('__el_shaday_msg', JSON.stringify({msg: msg, t:Date.now()}));
    }catch(e){ 
        console.warn('notify error', e); 
    }
}

/* --- Menu Renderer com Toggle de Categoria (Accordion) --- */

window.toggleCategory = function(catId, headerElement) {
    const listEl = document.getElementById(`list-${catId}`);
    if (listEl) {
        headerElement.closest('.category').classList.toggle('active');
    }
}

function renderMenu(data){
    const menuEl = document.getElementById('menu');
    if(!menuEl) return;

    menuEl.innerHTML = data.categorias.map((cat, index) => {
        const catId = cat.nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const isActive = '';
        return `
            <div class="category ${isActive}">
                <div class="category-header" onclick="toggleCategory('${catId}', this)">
                    <h2>${cat.nome}</h2>
                    <span class="toggle-icon">▼</span> 
                </div>
                <div class="items-list" id="list-${catId}">
                    ${cat.itens.map(item => `
                        <div class="menu-item" data-item-id="${item.id}">
                            <div class="item-header">
                                <div class="item-info">
                                    <div class="item-name">${item.nome}</div>
                                    ${item.descricaoDetalhada ? `<small class="muted">${item.descricaoDetalhada}</small>` : ''}
                                    <div class="item-price">${formatMoney(item.preco)}</div>
                                </div>
                                <button class="btn small" data-add="${item.id}">Adicionar</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

/* --- Cart logic --- */

let cart = []; // {id: 'p1', name: 'Pastel...', price: 12.00, qty: 1}

function loadCart(){
    try{
        const rawCart = localStorage.getItem(LS_CART_KEY);
        return rawCart ? JSON.parse(rawCart) : [];
    }catch(e){
        return [];
    }
}

function saveCart(currentCart){
    cart = currentCart;
    localStorage.setItem(LS_CART_KEY, JSON.stringify(cart)); 
    updateCartDisplay(); 
    saveAndBroadcastDraft(cart); // Notifica o admin sobre rascunho
}

function getProductById(id, productsData){
    for(const category of productsData.categorias){
        const product = category.itens.find(item => item.id === id);
        if(product) return product;
    }
    return null;
}

function updateCartDisplay(){
    // Desktop elements
    const cartItemsEl = document.getElementById('cart-items');
    const cartTotalEl = document.getElementById('cart-total');

    // Mobile elements
    const cartItemsMobileEl = document.getElementById('cart-items-mobile');
    const cartTotalMobileEl = document.getElementById('cart-total-mobile');

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // desktop update (if present)
    if(cartItemsEl && cartTotalEl){
        if(cart.length === 0){
            cartItemsEl.innerHTML = '<div class="muted" style="text-align:center;padding:12px;border:1px dashed #ddd;border-radius:8px">O carrinho está vazio.</div>';
            cartTotalEl.innerText = formatMoney(0);
        } else {
            cartItemsEl.innerHTML = cart.map((item, index) => `
                <div class="cart-item">
                    <div style="flex:1">
                        <div>${item.name}</div>
                        <small class="muted">${formatMoney(item.price)}</small>
                    </div>
                    <div class="qty">
                        <button data-change="${index}" data-action="decrease">-</button>
                        <span>${item.qty}</span>
                        <button data-change="${index}" data-action="increase">+</button>
                    </div>
                    <div>${formatMoney(item.price * item.qty)}</div>
                </div>
            `).join('');
            cartTotalEl.innerText = formatMoney(total);
        }
    }

    // mobile update (if present)
    if(cartItemsMobileEl && cartTotalMobileEl){
        if(cart.length === 0){
            cartItemsMobileEl.innerHTML = '<div class="muted" style="text-align:center;padding:12px;">O carrinho está vazio.</div>';
            cartTotalMobileEl.innerText = formatMoney(0);
        } else {
            cartItemsMobileEl.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <div style="flex:1">
                        <div>${item.name}</div>
                        <small class="muted">${formatMoney(item.price)}</small>
                    </div>
                    <div>${item.qty}x</div>
                    <div>${formatMoney(item.price * item.qty)}</div>
                </div>
            `).join('');
            cartTotalMobileEl.innerText = formatMoney(total);
        }
    }
}

function addToCart(productId, productsData){
    const product = getProductById(productId, productsData);
    if(!product) return;

    const existingItem = cart.find(item => item.id === productId);
    let newCart = [...cart];

    if(existingItem){
        // Aumenta a quantidade na cópia do carrinho
        newCart = newCart.map(item => item.id === productId ? {...item, qty: item.qty + 1} : item);
    } else {
        // Adiciona novo item na cópia do carrinho
        newCart.push({
            id: product.id,
            name: product.nome,
            price: product.preco,
            qty: 1
        });
    }
    saveCart(newCart);
}

function changeCartItemQty(index, action){
    if(index < 0 || index >= cart.length) return;
    
    let newCart = [...cart];

    if(action === 'increase'){
        newCart[index].qty += 1;
    } else if (action === 'decrease'){
        newCart[index].qty -= 1;
        if(newCart[index].qty <= 0){
            newCart.splice(index, 1);
        }
    }
    saveCart(newCart);
}

function clearCart(){
    saveCart([]); // Salva o carrinho vazio
    removeDraft(); // Remove o rascunho do cliente
}

/* --- Drafts logic (Rascunhos de carrinho para Admin) --- */

function getClientId(){
    let id = localStorage.getItem(DRAFT_ID_KEY);
    if (!id) {
        id = uid('client');
        localStorage.setItem(DRAFT_ID_KEY, id);
    }
    return id;
}

function readDrafts(){
    try{
        const raw = localStorage.getItem(LS_DRAFTS_KEY);
        return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
}

function writeDrafts(drafts, type = 'drafts_updated'){
    localStorage.setItem(LS_DRAFTS_KEY, JSON.stringify(drafts));
    notifyChannel({type:type}); // Notifica as outras abas sobre rascunhos atualizados
}

function calcCartTotal(currentCart){
    return currentCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

function saveAndBroadcastDraft(currentCart){
    const clientId = getClientId();
    let drafts = readDrafts();
    
    if (currentCart.length > 0) {
        // Transforma o array de cart para o formato de rascunho (itens: {id, nome, preco, q})
        const items = currentCart.map(i=>({id:i.id, nome:i.name, preco:i.price, q:i.qty}));
        drafts[clientId] = {
            id: clientId,
            timestamp: Date.now(),
            customer: document.getElementById('customer-name')?.value || document.getElementById('customer-name-mobile')?.value || 'Cliente',
            items: items,
            total: calcCartTotal(currentCart)
        };
    } else {
        delete drafts[clientId]; // Remove rascunho se carrinho estiver vazio
    }
    writeDrafts(drafts);
}

function removeDraft(){
    const clientId = getClientId();
    let drafts = readDrafts();
    if(drafts[clientId]){
        delete drafts[clientId];
        writeDrafts(drafts, 'drafts_updated');
    }
}

/* --- Admin / Order logic --- */

function loadOrders(){
    try{
        return JSON.parse(localStorage.getItem(LS_ORDERS_KEY)) || [];
    }catch(e){
        return [];
    }
}

function saveOrders(orders){
    try{
        localStorage.setItem(LS_ORDERS_KEY, JSON.stringify(orders));
    }catch(e){
        console.error('Failed to save orders to localStorage', e);
    }

    // CORREÇÃO: Usar a função unificada de notificação.
    notifyChannel({type: 'orders_updated'}); 
}

function sendOrder(customerName){
    if(cart.length === 0){
        alert('O carrinho está vazio!');
        return;
    }

    const newOrder = {
        id: generateOrderId(),
        customer: customerName,
        items: cart,
        total: cart.reduce((sum, item) => sum + (item.price * item.qty), 0),
        status: 'pending',
        timestamp: Date.now()
    };

    const orders = loadOrders();
    orders.unshift(newOrder);
    saveOrders(orders); // Salva e **notifica as outras abas**

    alert(`Pedido ${newOrder.id} de ${newOrder.customer} enviado com sucesso!`);
    clearCart(); // Limpa o carrinho e remove o rascunho
}

/* --- Admin render & status funcs --- */

function updateOrderStatus(orderId, newStatus){
    const orders = loadOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if(orderIndex !== -1){
        orders[orderIndex].status = newStatus;
        saveOrders(orders);
        renderOrders(); // Atualiza a tela da aba que fez a alteração
    } else {
        console.error(`Order with ID ${orderId} not found.`);
    }
}

// ... renderOrders e clearCompletedOrders (mantidas iguais) ...

function renderOrders(){
    const ordersWrap = document.getElementById('orders-wrap');
    if(!ordersWrap) return;

    // Lógica de detecção de painel (usada devido à reutilização do ID 'orders-wrap')
    const isCompletedPanel = ordersWrap.closest('.container')?.querySelector('small')?.textContent.includes('Concluídos');

    let orders = loadOrders();

    if(isCompletedPanel){
        orders = orders.filter(o => o.status === 'completed' || o.status === 'cancelled');
        
        // Lógica do botão Limpar Histórico
        let clearBtn = document.getElementById('clear-completed-btn');

        if(orders.length > 0 && !clearBtn){
            // Lógica para criar e adicionar o botão (mantida)
            clearBtn = document.createElement('button');
            clearBtn.id = 'clear-completed-btn';
            clearBtn.className = 'btn small danger';
            clearBtn.style.marginTop = '12px';
            clearBtn.textContent = 'Limpar Histórico de Concluídos';
            clearBtn.addEventListener('click', clearCompletedOrders);
            // Verifica se parentNode existe e insere
            if(ordersWrap.parentNode) ordersWrap.parentNode.insertBefore(clearBtn, ordersWrap.nextSibling);
        } else if (orders.length === 0 && clearBtn) {
            clearBtn.remove();
        }
    } else {
        orders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
    }

    if(orders.length === 0){
        ordersWrap.innerHTML = '<div class="muted" style="text-align:center;padding:12px;border:1px dashed #ddd;border-radius:8px">Nenhum pedido nesta lista.</div>';
        return;
    }

    ordersWrap.innerHTML = orders.map(order => {
        const statusClasses = {
            'pending': 'pending',
            'preparing': 'preparing',
            'ready': 'ready',
            'completed': 'completed',
            'cancelled': 'cancelled'
        };
        const statusText = {
            'pending': 'Pendente',
            'preparing': 'Em Preparo',
            'ready': 'Pronto',
            'completed': 'Concluído',
            'cancelled': 'Cancelado'
        };

        const isCompletedOrCancelled = order.status === 'completed' || order.status === 'cancelled';

        const actionsHtml = isCompletedOrCancelled ?
            '' :
            `
            <div style="margin-top:10px;display:flex;gap:8px">
                <button class="btn small" data-id="${order.id}" data-action="preparing" style="background:#007bff">Em Preparo</button>
                <button class="btn small" data-id="${order.id}" data-action="ready" style="background:#ffc107;color:#333">Pronto</button>
                <button class="btn small success" data-id="${order.id}" data-action="completed">Concluir</button>
                <button class="btn small danger" data-id="${order.id}" data-action="cancelled">Cancelar</button>
            </div>
        `;

        return `
            <div class="order ${statusClasses[order.status]}">
                <div class="order-header">
                    <div>
                        <strong>Pedido #${order.id}</strong>
                        <small class="muted">(${new Date(order.timestamp).toLocaleTimeString()})</small>
                    </div>
                    <div class="status-badge">${statusText[order.status]}</div>
                </div>
                <div class="customer-info">Cliente: ${order.customer}</div>
                <ul class="order-items-list">
                    ${order.items.map(item => `
                        <li>${item.qty}x ${item.name} - ${formatMoney(item.price * item.qty)}</li>
                    `).join('')}
                </ul>
                <div class="order-total">Total: <strong>${formatMoney(order.total)}</strong></div>
                ${actionsHtml}
            </div>
        `;
    }).join('');

    if(!isCompletedPanel){
        ordersWrap.querySelectorAll('button[data-id]').forEach(button => {
            button.addEventListener('click', (ev) => {
                const id = ev.target.dataset.id;
                const action = ev.target.dataset.action;
                updateOrderStatus(id, action);
            });
        });
    }
}

function clearCompletedOrders(){
    if(!confirm('Tem certeza que deseja limpar o histórico de pedidos concluídos/cancelados? Esta ação não pode ser desfeita.')) return;

    let orders = loadOrders();
    orders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
    saveOrders(orders);
    renderOrders();
}

// ... renderDrafts (mantida igual, mas adaptada para o novo formato de cart/draft) ...

function renderDrafts(){
    const draftsWrap = document.getElementById('drafts-wrap');
    if(!draftsWrap) return;

    const drafts = readDrafts();
    const activeDrafts = Object.values(drafts).sort((a, b) => b.timestamp - a.timestamp);

    draftsWrap.innerHTML = '';

    if (activeDrafts.length === 0) {
        draftsWrap.innerHTML = '<div class="muted" style="margin:20px 0;text-align:center;">Nenhum rascunho de pedido ativo.</div>';
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
                    <div><span class="status-badge status-novo" style="background:#007bff; color:#fff;">Em Andamento</span></div>
                </div>

                <div style="margin-top:8px;border-bottom:1px dashed #f0f0f0;padding-bottom:8px;">
                    ${ draft.items.map(it=>`<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;">
                        <div>${it.nome} x ${it.q}</div>
                        <div class="muted">${formatMoney(it.preco * it.q)}</div>
                    </div>`).join('') }
                </div>

                <div class="order-total" style="margin-top:8px">
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


/* --- Load Products (fetch / fallback) --- */

async function loadProducts(){
    try{
        const response = await fetch('data/produtos.json');
        if(!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        localStorage.setItem(LS_PRODUCTS_KEY, JSON.stringify(data));
        return data;
    }catch(e){
        try{
            const localData = JSON.parse(localStorage.getItem(LS_PRODUCTS_KEY));
            if(localData) return localData;
        } catch(e) {}
        return produtosEmbedded;
    }
}

/* --- App Mount Functions --- */

async function mountClient(){
    const data = await loadProducts();
    document.title = data.nome_loja + ' — Cardápio';
    if(document.getElementById('shop-name')) document.getElementById('shop-name').innerText = data.nome_loja;

    renderMenu(data);

    // Carrega o carrinho do localStorage ao iniciar
    cart = loadCart();
    updateCartDisplay(); 

    // Bind add buttons (delegation)
    const menuEl = document.getElementById('menu');
    if(menuEl){
        menuEl.addEventListener('click', (ev)=>{
            const addBtn = ev.target.closest('button[data-add]');
            if(addBtn){
                addToCart(addBtn.dataset.add, data);
            }
        });
    }

    // Bind desktop cart qty buttons (delegation)
    const desktopCartItems = document.getElementById('cart-items');
    if(desktopCartItems){
        desktopCartItems.addEventListener('click', (ev)=>{
            const changeBtn = ev.target.closest('button[data-change]');
            if(changeBtn){
                const index = parseInt(changeBtn.dataset.change, 10);
                const action = changeBtn.dataset.action;
                changeCartItemQty(index, action);
            }
        });
    }
}

function mountAdmin(){
    const el = document.getElementById('shop-name-admin');
    const dataRaw = localStorage.getItem(LS_PRODUCTS_KEY);
    const data = dataRaw ? JSON.parse(dataRaw) : produtosEmbedded;
    if(el) el.innerText = data.nome_loja;
    
    // Carrega os rascunhos na inicialização do admin
    renderDrafts(); 
    
    renderOrders();
}

/* --- Notificação em tempo real (BroadcastChannel e localStorage) --- */

if(bcSupported){
    bc.onmessage = (ev) => {
        // CORREÇÃO: Verifica se a mensagem veio da BroadcastChannel e atualiza
        if(ev.data && ev.data.type === 'orders_updated') renderOrders();
        if(ev.data && ev.data.type === 'drafts_updated') renderDrafts();
    };
}

// CORREÇÃO: Leitura correta da mensagem de atualização do localStorage
window.addEventListener('storage', (ev)=>{
    if(ev.key === '__el_shaday_msg'){
        try{
            const payload = JSON.parse(ev.newValue);
            const msg = payload.msg; // Agora a mensagem real está dentro de 'msg'
            // CORREÇÃO: Ação de renderOrders
            if(msg && msg.type === 'orders_updated') renderOrders(); 
            if(msg && msg.type === 'drafts_updated') renderDrafts();
        }catch(e){}
    }
    // Adiciona listener direto para LS_DRAFTS_KEY (mesmo que a notificação unificada já faça isso)
    // Isso garante a atualização mesmo que a notificação via __el_shaday_msg falhe.
    if(ev.key === LS_ORDERS_KEY) renderOrders(); 
});

/* --- inicialização condicional (cliente vs admin) --- */

document.addEventListener('DOMContentLoaded', ()=>{
    // mount client/admin if elements exist
    if(document.getElementById('menu')) mountClient();
    if(document.getElementById('orders-wrap') || document.getElementById('drafts-wrap')) mountAdmin(); // Adiciona drafts-wrap

    // client bindings (send / clear)
    const sendBtn = document.getElementById('send-order-btn');
    if(sendBtn){
        sendBtn.addEventListener('click', ()=>{
            const customer = document.getElementById('customer-name')?.value || 'Cliente';
            sendOrder(customer);
        });
    }

    const clearBtn = document.getElementById('clear-cart-btn');
    if(clearBtn){
        clearBtn.addEventListener('click', clearCart);
    }

    // --- Mobile cart panel bindings (single registration) ---
    const toggleBtn = document.getElementById('mobile-cart-toggle');
    const panel = document.getElementById('mobile-cart-panel');
    const closeBtn = document.getElementById('close-cart-panel');
    const sendBtnMobile = document.getElementById('send-order-btn-mobile');

    if(toggleBtn && panel){
        toggleBtn.addEventListener('click', ()=>{
            // update content before opening
            updateCartDisplay();
            panel.classList.add('open');
        });
    }

    if(closeBtn && panel){
        closeBtn.addEventListener('click', ()=>{
            panel.classList.remove('open');
        });
    }

    if(sendBtnMobile){
        sendBtnMobile.addEventListener('click', ()=>{
            const customer = document.getElementById('customer-name-mobile')?.value || 'Cliente';
            sendOrder(customer);
            // close panel after sending
            if(panel) panel.classList.remove('open');
        });
    }

    // ensure mobile panel updates when page loads
    updateCartDisplay();
});