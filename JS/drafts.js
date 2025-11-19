/* js/drafts.js — Lógica de Rascunhos de Pedidos para o Admin */
import { formatMoney, notifyChannel, uid } from './utils.js';
import { LS_DRAFTS_KEY, DRAFT_ID_KEY } from './constants.js';

export function getClientId(){
    let id = localStorage.getItem(DRAFT_ID_KEY);
    if (!id) {
        id = uid('client');
        localStorage.setItem(DRAFT_ID_KEY, id);
    }
    return id;
}

export function readDrafts(){
    try{
        const raw = localStorage.getItem(LS_DRAFTS_KEY);
        return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
}

export function writeDrafts(drafts, type = 'drafts_updated'){
    localStorage.setItem(LS_DRAFTS_KEY, JSON.stringify(drafts));
    notifyChannel({type:type});
}

function calcCartTotal(currentCart){
    // Assumes cart structure: {id, name, price, qty}
    return currentCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

export function saveAndBroadcastDraft(currentCart){
    const clientId = getClientId();
    let drafts = readDrafts();
    
    if (currentCart.length > 0) {
        const items = currentCart.map(i=>({id:i.id, nome:i.name, preco:i.price, q:i.qty}));
        drafts[clientId] = {
            id: clientId,
            timestamp: Date.now(),
            customer: document.getElementById('customer-name')?.value || document.getElementById('customer-name-mobile')?.value || 'Cliente',
            items: items,
            total: calcCartTotal(currentCart)
        };
    } else {
        delete drafts[clientId];
    }
    writeDrafts(drafts);
}

export function removeDraft(){
    const clientId = getClientId();
    let drafts = readDrafts();
    if(drafts[clientId]){
        delete drafts[clientId];
        writeDrafts(drafts, 'drafts_updated');
    }
}

export function renderDrafts(){
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