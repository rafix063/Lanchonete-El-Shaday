/* js/orders.js — Lógica de Pedidos e Admin */
import { formatMoney, notifyChannel, generateOrderId } from './utils.js';
import { LS_ORDERS_KEY, LS_PRODUCTS_KEY } from './constants.js';
import { getCart, clearCart } from './cart.js';
import { removeDraft } from './drafts.js';

export function loadOrders(){
    try{
        return JSON.parse(localStorage.getItem(LS_ORDERS_KEY)) || [];
    }catch(e){
        return [];
    }
}

export function saveOrders(orders){
    try{
        localStorage.setItem(LS_ORDERS_KEY, JSON.stringify(orders));
    }catch(e){
        console.error('Failed to save orders to localStorage', e);
    }
    notifyChannel({type: 'orders_updated'}); 
}

export function sendOrder(customerName){
    const cart = getCart(); // Obtém o estado atual do carrinho
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
    saveOrders(orders);

    alert(`Pedido ${newOrder.id} de ${newOrder.customer} enviado com sucesso!`);
    clearCart(); // Limpa o carrinho
    removeDraft(); // Remove o rascunho
}

export function updateOrderStatus(orderId, newStatus){
    const orders = loadOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if(orderIndex !== -1){
        orders[orderIndex].status = newStatus;
        saveOrders(orders);
        // Não é necessário chamar renderOrders aqui, pois saveOrders chama notifyChannel, que fará a renderização nas abas, incluindo a atual.
    } else {
        console.error(`Order with ID ${orderId} not found.`);
    }
}

export function clearCompletedOrders(){
    if(!confirm('Tem certeza que deseja limpar o histórico de pedidos concluídos/cancelados? Esta ação não pode ser desfeita.')) return;

    let orders = loadOrders();
    orders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
    saveOrders(orders);
}

export function renderOrders(){
    const ordersWrap = document.getElementById('orders-wrap') || document.getElementById('completed-orders-wrap');
    if(!ordersWrap) return;

    // Lógica de detecção de painel (baseado no ID ou no parent)
    const isCompletedPanel = ordersWrap.id === 'completed-orders-wrap'; 

    let orders = loadOrders();

    if(isCompletedPanel){
        orders = orders.filter(o => o.status === 'completed' || o.status === 'cancelled');
        // Lógica do botão Limpar Histórico
        let clearBtn = document.getElementById('clear-completed-btn');
        if(orders.length > 0 && !clearBtn){
            clearBtn = document.createElement('button');
            clearBtn.id = 'clear-completed-btn';
            clearBtn.className = 'btn small danger';
            clearBtn.style.marginTop = '12px';
            clearBtn.textContent = 'Limpar Histórico de Concluídos';
            clearBtn.addEventListener('click', clearCompletedOrders);
            if(ordersWrap.parentNode) ordersWrap.parentNode.insertBefore(clearBtn, ordersWrap.nextSibling);
        } else if (orders.length === 0 && clearBtn) {
            clearBtn.remove();
        }
    } else {
        orders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
        if(document.getElementById('clear-completed-btn')) document.getElementById('clear-completed-btn').remove();
    }

    if(orders.length === 0){
        ordersWrap.innerHTML = '<div class="muted" style="text-align:center;padding:12px;border:1px dashed #ddd;border-radius:8px">Nenhum pedido nesta lista.</div>';
        return;
    }

    ordersWrap.innerHTML = orders.map(order => {
        const statusClasses = { /* ... */ };
        const statusText = { /* ... */ };

        const isCompletedOrCancelled = order.status === 'completed' || order.status === 'cancelled';

        const actionsHtml = isCompletedOrCancelled ?
            '' :
            `
            <div style="margin-top:10px;display:flex;gap:8px" class="admin-actions">
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

    // **IMPORTANTE**: Os bindings dos botões de ação são feitos no main.js
}