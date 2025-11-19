/* js/main.js — Inicialização do sistema */
import { loadProducts, renderMenu } from './menu.js';
import { loadCart, updateCartDisplay, addToCart, changeCartItemQty, removeItemFromCart, clearCart } from './cart.js';
import { sendOrder, renderOrders, updateOrderStatus } from './orders.js';
import { renderDrafts } from './drafts.js';
import { bc, bcSupported } from './utils.js';

let productsData = null;

// --- CLIENTE ---
async function mountClient(){
    productsData = await loadProducts();

    document.title = productsData.nome_loja + " — Cardápio";

    const shop = document.getElementById('shop-name');
    if(shop) shop.innerText = productsData.nome_loja;

    renderMenu(productsData);
    loadCart();
    updateCartDisplay();
}

// --- ADMIN ---
function mountAdmin(){
    renderDrafts();
    renderOrders();
}

// 🌐 EVENTOS EM TEMPO REAL
function setupChannelListeners(){

    // BroadcastChannel
    if(bcSupported){
        bc.onmessage = ev => {
            if(ev.data?.type === "orders_updated") renderOrders();
            if(ev.data?.type === "drafts_updated") renderDrafts();
        };
    }

    // Fallback: storage event
    window.addEventListener("storage", ev => {

        if(ev.key === "__el_shaday_msg"){
            try{
                const obj = JSON.parse(ev.newValue);
                const msg = obj.msg;

                if(msg?.type === "orders_updated") renderOrders();
                if(msg?.type === "drafts_updated") renderDrafts();
            }catch{}
        }

        if(ev.key === "el_shaday_orders_v1"){
            renderOrders();
        }
    });
}

// 🎛 EVENTOS DO CLIENTE
function setupClientBindings(){

    // Menu → Add
    const menu = document.getElementById("menu");
    if(menu){
        menu.addEventListener("click", ev => {
            const btn = ev.target.closest("button[data-add]");
            if(btn) addToCart(btn.dataset.add, productsData);
        });
    }

    // Carrinho + qty/remove
    document.body.addEventListener("click", ev => {
        const plusMinus = ev.target.closest("button[data-change]");
        const remove = ev.target.closest("button[data-remove]");

        if(plusMinus){
            changeCartItemQty(+plusMinus.dataset.change, plusMinus.dataset.action);
            return;
        }

        if(remove){
            removeItemFromCart(remove.dataset.remove);
        }
    });

    // Enviar (desktop)
    const send = document.getElementById("send-order-btn");
    if(send){
        send.addEventListener("click", ()=>{
            const name = document.getElementById("customer-name")?.value || "Cliente";
            sendOrder(name);
        });
    }

    const clear = document.getElementById("clear-cart-btn");
    if(clear) clear.addEventListener("click", clearCart);

    // MOBILE PANEL
    const toggle = document.getElementById("mobile-cart-toggle");
    const panel = document.getElementById("mobile-cart-panel");
    const close = document.getElementById("close-cart-panel");
    const sendMobile = document.getElementById("send-order-btn-mobile");

    if(toggle && panel){
        toggle.addEventListener("click", ()=>{
            updateCartDisplay();
            panel.classList.add("open");
        });
    }

    if(close && panel){
        close.addEventListener("click", ()=> panel.classList.remove("open"));
    }

    if(sendMobile){
        sendMobile.addEventListener("click", ()=>{
            const name = document.getElementById("customer-name-mobile")?.value || "Cliente";
            sendOrder(name);
            panel.classList.remove("open");
        });
    }
}

// 🎛 EVENTOS DO ADMIN
function setupAdminBindings(){
    const wrap =
        document.getElementById("orders-wrap") ||
        document.getElementById("completed-orders-wrap");

    if(!wrap) return;

    wrap.addEventListener("click", ev => {
        const btn = ev.target.closest("button[data-id]");
        if(btn && btn.closest(".admin-actions")){
            updateOrderStatus(btn.dataset.id, btn.dataset.action);

            // 👇 ATUALIZA IMEDIATAMENTE NO PAINEL ADMIN
            renderOrders();
        }
    });
}

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
    setupChannelListeners();

    if(document.getElementById("menu")){
        mountClient();
        setupClientBindings();
    }

    if(
        document.getElementById("orders-wrap") ||
        document.getElementById("completed-orders-wrap") ||
        document.getElementById("drafts-wrap")
    ){
        mountAdmin();
        setupAdminBindings();
    }

    updateCartDisplay();
});
