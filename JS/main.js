/* js/main.js — Inicialização e Bindings de Eventos */
import { loadProducts, renderMenu, getProductById } from './menu.js';
import { loadCart, updateCartDisplay, addToCart, changeCartItemQty, removeItemFromCart, clearCart } from './cart.js';
import { sendOrder, renderOrders, updateOrderStatus } from './orders.js';
import { renderDrafts } from './drafts.js';
import { bc, bcSupported } from './utils.js';

let productsData = null; // Armazena os dados dos produtos globalmente

// --- Mount Functions ---

async function mountClient(){
    productsData = await loadProducts(); // Carrega e armazena os dados
    document.title = productsData.nome_loja + ' — Cardápio';
    if(document.getElementById('shop-name')) document.getElementById('shop-name').innerText = productsData.nome_loja;

    renderMenu(productsData);

    loadCart(); // Carrega o carrinho do localStorage
    updateCartDisplay(); 
}

function mountAdmin(){
    const dataRaw = localStorage.getItem('el_shaday_products_v1');
    if(document.getElementById('shop-name-admin')) {
        const data = dataRaw ? JSON.parse(dataRaw) : {nome_loja: 'El Shaday Lanchonete'};
        document.getElementById('shop-name-admin').innerText = data.nome_loja;
    }
    
    renderDrafts(); 
    renderOrders();
}

// --- Notificações em tempo real (Global Listener) ---

function setupChannelListeners(){
    if(bcSupported){
        bc.onmessage = (ev) => {
            if(ev.data && ev.data.type === 'orders_updated') renderOrders();
            if(ev.data && ev.data.type === 'drafts_updated') renderDrafts();
        };
    }

    window.addEventListener('storage', (ev)=>{
        if(ev.key === '__el_shaday_msg'){
            try{
                const payload = JSON.parse(ev.newValue);
                const msg = payload.msg;
                if(msg && msg.type === 'orders_updated') renderOrders(); 
                if(msg && msg.type === 'drafts_updated') renderDrafts();
            }catch(e){}
        }
        if(ev.key === 'el_shaday_orders_v1') renderOrders(); 
    });
}

// --- Bindings de Eventos (Delegation) ---

function setupClientBindings(){
    // Bind add buttons (delegation for menu items)
    const menuEl = document.getElementById('menu');
    if(menuEl){
        menuEl.addEventListener('click', (ev)=>{
            const addBtn = ev.target.closest('button[data-add]');
            if(addBtn){
                addToCart(addBtn.dataset.add, productsData);
            }
        });
    }

    // Bind cart/qty buttons (delegation for desktop and mobile)
    document.body.addEventListener('click', (ev) => {
        // Quantidade (+/-)
        const changeBtn = ev.target.closest('button[data-change]');
        if(changeBtn){
            const index = parseInt(changeBtn.dataset.change, 10);
            const action = changeBtn.dataset.action;
            changeCartItemQty(index, action);
            return;
        }

        // Remoção total (X)
        const removeBtn = ev.target.closest('button[data-remove]');
        if(removeBtn){
            removeItemFromCart(removeBtn.dataset.remove);
            return;
        }
    });

    // Send/Clear buttons (Desktop)
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
    
    // Mobile cart panel bindings
    const toggleBtn = document.getElementById('mobile-cart-toggle');
    const panel = document.getElementById('mobile-cart-panel');
    const closeBtn = document.getElementById('close-cart-panel');
    const sendBtnMobile = document.getElementById('send-order-btn-mobile');

    if(toggleBtn && panel){
        toggleBtn.addEventListener('click', ()=>{
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
            if(panel) panel.classList.remove('open');
        });
    }
}

function setupAdminBindings(){
     // Bind buttons for order status change (delegation for admin/pedidos-concluidos)
    const adminWrap = document.getElementById('orders-wrap') || document.getElementById('completed-orders-wrap');
    if(adminWrap){
        adminWrap.addEventListener('click', (ev) => {
            const button = ev.target.closest('button[data-id]');
            if(button && button.closest('.admin-actions')){
                const id = button.dataset.id;
                const action = button.dataset.action;
                updateOrderStatus(id, action);
            }
        });
    }
}

// --- Inicialização ---

document.addEventListener('DOMContentLoaded', ()=>{
    setupChannelListeners();

    if(document.getElementById('menu')){
        mountClient();
        setupClientBindings();
    }
    if(document.getElementById('orders-wrap') || document.getElementById('completed-orders-wrap') || document.getElementById('drafts-wrap')){
        mountAdmin();
        setupAdminBindings();
    }

    // Garante que o display do carrinho esteja correto na inicialização
    updateCartDisplay();
});