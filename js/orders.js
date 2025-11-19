/* js/orders.js — Lógica de Pedidos e Admin */
import { formatMoney, notifyChannel, generateOrderId } from './utils.js';
import { LS_ORDERS_KEY } from './constants.js';
import { getCart, clearCart } from './cart.js';
import { removeDraft } from './drafts.js';

export function loadOrders(){
    try {
        return JSON.parse(localStorage.getItem(LS_ORDERS_KEY)) || [];
    } catch {
        return [];
    }
}

export function saveOrders(orders){
    localStorage.setItem(LS_ORDERS_KEY, JSON.stringify(orders));
    notifyChannel({ type: 'orders_updated' });
}

export function sendOrder(customerName){
    const cart = getCart();
    if(cart.length === 0){
        alert("O carrinho está vazio!");
        return;
    }

    const newOrder = {
        id: generateOrderId(),
        customer: customerName,
        items: cart,
        total: cart.reduce((sum, i)=> sum + (i.price * i.qty), 0),
        status: 'pending',
        timestamp: Date.now()
    };

    const orders = loadOrders();
    orders.unshift(newOrder);

    saveOrders(orders);

    alert(`Pedido ${newOrder.id} enviado com sucesso!`);
    clearCart();
    removeDraft();
}

export function updateOrderStatus(orderId, newStatus){
    const orders = loadOrders();
    const index = orders.findIndex(o => o.id === orderId);

    if(index === -1){
        console.error("Order not found:", orderId);
        return;
    }

    orders[index].status = newStatus;
    saveOrders(orders);

    // 👇 FORÇA ATUALIZAÇÃO LOCAL IMEDIATA
    renderOrders();
}

export function clearCompletedOrders(){
    if(!confirm("Tem certeza que deseja limpar os pedidos concluídos / cancelados?")) return;
    let orders = loadOrders().filter(o => o.status !== "completed" && o.status !== "cancelled");
    saveOrders(orders);
}

export function renderOrders(){
    const wrap = document.getElementById('orders-wrap') || document.getElementById('completed-orders-wrap');
    if(!wrap) return;

    const isCompleted = wrap.id === 'completed-orders-wrap';

    let orders = loadOrders();

    if(isCompleted){
        orders = orders.filter(o => o.status === 'completed' || o.status === 'cancelled');

        let clearBtn = document.getElementById("clear-completed-btn");

        if(orders.length && !clearBtn){
            clearBtn = document.createElement("button");
            clearBtn.id = "clear-completed-btn";
            clearBtn.className = "btn small danger";
            clearBtn.style.marginTop = "12px";
            clearBtn.textContent = "Limpar Histórico";
            clearBtn.addEventListener("click", clearCompletedOrders);

            wrap.parentNode.insertBefore(clearBtn, wrap.nextSibling);
        }

        if(!orders.length && clearBtn){
            clearBtn.remove();
        }

    } else {
        orders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');

        const existing = document.getElementById("clear-completed-btn");
        if(existing) existing.remove();
    }

    if(!orders.length){
        wrap.innerHTML = `
            <div class="muted" style="padding:12px;text-align:center;border:1px dashed #ccc;border-radius:8px">
                Nenhum pedido nesta lista.
            </div>`;
        return;
    }

    const statusText = {
        pending: 'Pendente',
        preparing: 'Em Preparo',
        ready: 'Pronto',
        completed: 'Concluído',
        cancelled: 'Cancelado'
    };

    const statusClass = {
        pending: 'pending',
        preparing: 'preparing',
        ready: 'ready',
        completed: 'completed',
        cancelled: 'cancelled'
    };

    wrap.innerHTML = orders.map(order => {
        const finished = order.status === 'completed' || order.status === 'cancelled';

        return `
            <div class="order ${statusClass[order.status]}">
                <div class="order-header">
                    <div>
                        <strong>Pedido #${order.id}</strong>
                        <small class="muted"> (${new Date(order.timestamp).toLocaleTimeString()})</small>
                    </div>
                    <div class="status-badge">${statusText[order.status]}</div>
                </div>

                <div class="customer-info">Cliente: ${order.customer}</div>

                <ul class="order-items-list">
                    ${order.items.map(i => `
                        <li>${i.qty}x ${i.name} — ${formatMoney(i.price * i.qty)}</li>
                    `).join('')}
                </ul>

                <div class="order-total">
                    Total: <strong>${formatMoney(order.total)}</strong>
                </div>

                ${ finished ? "" : `
                    <div class="admin-actions" style="margin-top:10px;display:flex;gap:8px">
                        <button class="btn small" data-id="${order.id}" data-action="preparing" style="background:#007bff">Em Preparo</button>
                        <button class="btn small" data-id="${order.id}" data-action="ready" style="background:#ffc107;color:#333">Pronto</button>
                        <button class="btn small success" data-id="${order.id}" data-action="completed">Concluir</button>
                        <button class="btn small danger" data-id="${order.id}" data-action="cancelled">Cancelar</button>
                    </div>
                `}
            </div>
        `;
    }).join('');
}
