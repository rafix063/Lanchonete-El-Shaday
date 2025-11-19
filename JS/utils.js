/* js/utils.js — Funções Utilitárias e Canal de Comunicação */
import { CHANNEL_NAME } from './constants.js';

export const bcSupported = ('BroadcastChannel' in window);
export const bc = bcSupported ? new BroadcastChannel(CHANNEL_NAME) : null;

export function formatMoney(value){
    return new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(value);
}

export function generateOrderId(){
    const date = new Date();
    const timestamp = date.getTime();
    const random = Math.floor(Math.random() * 900) + 100;
    return `${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}-${timestamp.toString().slice(-4)}${random}`;
}

export function uid(prefix = ''){
    return prefix + Math.random().toString(36).substring(2, 9);
}

export function notifyChannel(msg){
    try{
        if(bc) bc.postMessage(msg);
        localStorage.setItem('__el_shaday_msg', JSON.stringify({msg: msg, t:Date.now()}));
    }catch(e){ 
        console.warn('notify error', e); 
    }
}