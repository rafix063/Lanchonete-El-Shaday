/* js/cart.js — Lógica Central do Carrinho */
import { formatMoney } from './utils.js';
import { LS_CART_KEY } from './constants.js';
import { saveAndBroadcastDraft } from './drafts.js';
import { getProductById } from './menu.js';

let cart = []; // Estado local

export function getCart(){
    return cart;
}

export function loadCart(){
    try{
        const rawCart = localStorage.getItem(LS_CART_KEY);
        cart = rawCart ? JSON.parse(rawCart) : [];
        return cart;
    }catch(e){
        cart = [];
        return [];
    }
}

export function saveCart(currentCart){
    cart = currentCart;
    localStorage.setItem(LS_CART_KEY, JSON.stringify(cart)); 
    updateCartDisplay(); 
    saveAndBroadcastDraft(cart);
}

export function addToCart(productId, productsData){
    const product = getProductById(productId, productsData);
    if(!product) return;

    const existingItem = cart.find(item => item.id === productId);
    let newCart = [...cart];

    if(existingItem){
        newCart = newCart.map(item => item.id === productId ? {...item, qty: item.qty + 1} : item);
    } else {
        newCart.push({
            id: product.id,
            name: product.nome,
            price: product.preco,
            qty: 1
        });
    }
    saveCart(newCart);
}

export function removeItemFromCart(productId){
    let newCart = cart.filter(item => item.id !== productId);
    saveCart(newCart);
}

export function changeCartItemQty(index, action){
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

export function updateCartDisplay(){
    // Desktop elements
    const cartItemsEl = document.getElementById('cart-items');
    const cartTotalEl = document.getElementById('cart-total');

    // Mobile elements
    const cartItemsMobileEl = document.getElementById('cart-items-mobile');
    const cartTotalMobileEl = document.getElementById('cart-total-mobile');
    const cartCountMobile = document.getElementById('cart-count-mobile'); 

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

    // Desktop update (if present)
    if(cartItemsEl && cartTotalEl){
        if(cart.length === 0){
            cartItemsEl.innerHTML = '<div class="muted" style="text-align:center;padding:12px;border:1px dashed #ddd;border-radius:8px">O carrinho está vazio.</div>';
            cartTotalEl.innerText = formatMoney(0);
        } else {
            cartItemsEl.innerHTML = cart.map((item, index) => `
                <div class="cart-item" style="align-items:center;">
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
                    <button data-remove="${item.id}" class="remove-btn" aria-label="Remover item" 
                        style="background:none;border:none;color:#ff3333;font-size:18px;line-height:1;cursor:pointer;padding:0 0 0 8px;margin-left:8px;">
                        &times;
                    </button>
                </div>
            `).join('');
            cartTotalEl.innerText = formatMoney(total);
        }
    }

    // Mobile update (if present)
    if(cartItemsMobileEl && cartTotalMobileEl){
        if(cart.length === 0){
            cartItemsMobileEl.innerHTML = '<div class="muted" style="text-align:center;padding:12px;">O carrinho está vazio.</div>';
            cartTotalMobileEl.innerText = formatMoney(0);
        } else {
            cartItemsMobileEl.innerHTML = cart.map((item, index) => `
                <div class="cart-item" style="justify-content:space-between;align-items:center;padding:8px 0;">
                    <div style="flex:1">
                        <div>${item.name}</div>
                        <small class="muted">${formatMoney(item.price * item.qty)}</small>
                    </div>
                    <div class="qty" style="margin: 0 10px;">
                        <button data-change="${index}" data-action="decrease">-</button>
                        <span style="min-width: 20px; text-align: center;">${item.qty}</span>
                        <button data-change="${index}" data-action="increase">+</button>
                    </div>
                    <button data-remove="${item.id}" class="remove-btn" aria-label="Remover item" 
                        style="background:none;border:none;color:#ff3333;font-size:18px;line-height:1;cursor:pointer;padding:0;margin-left:10px;">
                        &times;
                    </button>
                </div>
            `).join('');
            cartTotalMobileEl.innerText = formatMoney(total);
        }
    }
    
    // Update Mobile Badge Count
    if(cartCountMobile){
        cartCountMobile.innerText = totalItems;
        if(totalItems > 0){
            cartCountMobile.classList.add('visible');
        } else {
            cartCountMobile.classList.remove('visible');
        }
    }
}

export function clearCart(){
    saveCart([]); 
}

// Coloca a função no escopo global para que o onclick no HTML (se ainda for usado) funcione.
// MUDANÇA: É melhor remover o onclick no HTML e usar delegação em main.js.
// Para evitar quebrar o código anterior, vamos exportar e ligar em main.js