/**
 * Motor Experimental y Lógica de Teoría de Juegos
 * Proyecto: Tarea Computarizada de Dilema de Bienes Públicos
 */

// Limpieza inicial para borrar bases de datos con formato viejo
if(!localStorage.getItem('db_cleared_v10_wide')) {
    localStorage.removeItem('bienes_publicos_db');
    localStorage.setItem('db_cleared_v10_wide', 'true');
}

const CONFIG = {
  N_GRUPO: 4, MULTIPLICADOR: 1.5, DOTACION_MENSUAL: 1000, VALOR_INICIAL_CISTERNA: 4000,
  ENSAYOS_POR_BLOQUE_FULL: 10, ENSAYOS_POR_BLOQUE_TEST: 3,
  TIEMPO_TRANSICION_B1_SEG: 10, TIEMPO_DESCANSO_FULL_SEG: 60
};

// URL de Google Apps Script
const GOOGLE_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzk77Op3xSqr5hieKZN-RR0mx-i7vpDPGTzcxlaxml7O5-yNF3KYyjbTKR-TY_O8LPyBA/exec";

// GENERADOR DE VARIABLES PARA CSV (Formato Ancho)
const CSV_HEADERS = ["participante", "edad", "genero", "carrera", "participacion_previa", "orden_bloques", "perfil_vecinos"];
for(let i=1; i<=20; i++){
    CSV_HEADERS.push(`ensayo_${i}_bloque`, `ensayo_${i}_condicion`, `ensayo_${i}_aporte_publico`, `ensayo_${i}_fondo_privado`, `ensayo_${i}_tr_ms`, `ensayo_${i}_bot1`, `ensayo_${i}_bot2`, `ensayo_${i}_bot3`, `ensayo_${i}_ganancia`);
}
CSV_HEADERS.push("ganancia_b1", "ganancia_b2", "ganancia_total");

let state = {
    participantId: '', metadata: {}, order: '', profile: '', currentPhase: 'practice', currentTrialIndex: 0, startTime: 0,
    trialData: [], accumulatedWealth: { user: 0, bot1: 0, bot2: 0, bot3: 0 },
    coopHistory: { user: [], bot1: [], bot2: [], bot3: [], labels: [] }
};

let wealthChartInstance = null; let coopChartInstance = null; let finalChartInstance = null; let avgCoopChartInstance = null;

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    let header = document.getElementById('global-header');
    if (header) {
        if (id === 'screen-welcome') header.classList.add('hidden-header');
        else header.classList.remove('hidden-header');
    }
    window.scrollTo(0,0);
}

function iniciarDesdeBienvenida() { showScreen('screen-demographics'); }

function startExperimentSetup() {
    let inputs = ['demo-age', 'demo-gender', 'demo-career', 'demo-prev'];
    let hasError = false; let values = {};

    inputs.forEach(id => {
        let element = document.getElementById(id);
        element.style.border = '2px solid transparent';
        let val = element.value.trim();
        if (!val) { element.style.border = '2px solid var(--error-suave)'; hasError = true; }
        values[id] = val;
    });

    let consentCheck = document.getElementById('demo-consent');
    if(!consentCheck.checked) {
        hasError = true;
        consentCheck.parentElement.style.color = "var(--error-suave)";
        consentCheck.parentElement.style.fontWeight = "bold";
    } else {
        consentCheck.parentElement.style.color = "inherit";
        consentCheck.parentElement.style.fontWeight = "normal";
    }

    if (hasError) { alert("⚠️ Faltan datos o no has aceptado el consentimiento informado."); return; }

    state.participantId = 'P-' + Math.floor(1000 + Math.random() * 9000);
    state.order = Math.random() > 0.5 ? 'PR_MA' : 'MA_PR';
    let profiles = ['polizones', 'condicionales', 'incondicionales'];
    state.profile = profiles[Math.floor(Math.random() * profiles.length)];
    state.metadata = { age: values['demo-age'], gender: values['demo-gender'], career: values['demo-career'], prev: values['demo-prev'] };
    showScreen('screen-instructions');
}

function startPractice() { state.currentPhase = 'practice'; state.currentTrialIndex = 0; loadTrialUI(); }

function initTransitionB1() {
    showScreen('screen-transition-b1');
    let timerEl = document.getElementById('transition-timer');
    let timeLeft = CONFIG.TIEMPO_TRANSICION_B1_SEG;
    let interval = setInterval(() => {
        let s = String(timeLeft).padStart(2, '0');
        if(timerEl) timerEl.innerText = `00:${s}`;
        if(timeLeft <= 0) { clearInterval(interval); startBlock1(); }
        timeLeft--;
    }, 1000);
}

function startBlock1() {
    state.currentPhase = 'block1'; state.currentTrialIndex = 0;
    state.accumulatedWealth = { user: 0, bot1: 0, bot2: 0, bot3: 0 };
    state.coopHistory = { user: [], bot1: [], bot2: [], bot3: [], labels: [] };
    loadTrialUI();
}

function startBlock2() {
    state.currentPhase = 'block2'; state.currentTrialIndex = 0;
    state.coopHistory = { user: [], bot1: [], bot2: [], bot3: [], labels: [] };
    loadTrialUI();
}

function normalRandom(mean, stdDev, min = null, max = null) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  let value = mean + z * stdDev;
  if (min !== null) value = Math.max(min, value);
  if (max !== null) value = Math.min(max, value);
  return Math.round(value);
}

function generarDecisionesBots(perfil, tipoDilema, numeroEnsayo, decisionPreviaUsuario = null) {
  const bots = [];
  for (let i = 0; i < 3; i++) {
    let valor = 0;
    if (perfil === 'polizones') valor = tipoDilema === 'provision' ? normalRandom(50, 25, 0, 100) : normalRandom(950, 25, 900, 1000);
    else if (perfil === 'incondicionales') valor = tipoDilema === 'provision' ? normalRandom(750, 30, 700, 800) : normalRandom(250, 30, 200, 300);
    else if (perfil === 'condicionales') valor = (numeroEnsayo === 1 || decisionPreviaUsuario === null) ? normalRandom(500, 40, 0, 1000) : normalRandom(decisionPreviaUsuario, 45, 0, 1000);
    bots.push(valor);
  }
  return bots;
}

function getActiveCondition() {
    if(state.order === 'PR_MA') return state.currentPhase === 'block1' ? 'provision' : 'mantenimiento';
    return state.currentPhase === 'block1' ? 'mantenimiento' : 'provision';
}

function loadTrialUI() {
    showScreen('screen-trial');
    let inputComun = document.getElementById('input-comun'); let inputPrivado = document.getElementById('input-privado');
    if(inputComun) inputComun.value = ''; if(inputPrivado) inputPrivado.value = '';
    
    let btnConfirm = document.getElementById('btn-confirm-trial'); if(btnConfirm) btnConfirm.disabled = true;
    let msg = document.getElementById('validation-msg'); if(msg) msg.classList.remove('visible');
    
    let totalTrials = (state.currentPhase === 'practice') ? CONFIG.ENSAYOS_POR_BLOQUE_TEST : CONFIG.ENSAYOS_POR_BLOQUE_FULL;
    let condition = getActiveCondition();
    
    document.getElementById('trial-counter').innerHTML = `Mes <strong>${state.currentTrialIndex + 1}</strong> de <strong>${totalTrials}</strong>`;
    
    if(state.currentPhase === 'practice') {
        document.getElementById('trial-context').innerHTML = "Contexto: Instalación de paneles solares en área común. ¿Cuánto de tus <strong>$1,000 MXN</strong> aportas al fondo de paneles y cuánto dejas para ti?";
        document.getElementById('label-comun').innerText = "Fondo Paneles (Común)";
        document.getElementById('label-privado').innerText = "Cuenta Privada";
    } else if(condition === 'provision') {
        document.getElementById('trial-context').innerHTML = "Condominio sin cisterna (0% agua). Subsidio de <strong>$1,000 MXN</strong>. ¿Cuánto aportas al fondo común para construir la cisterna y cuánto conservas en tu cuenta?";
        document.getElementById('label-comun').innerText = "Aportar a Cisterna (Común)";
        document.getElementById('label-privado').innerText = "Conservar (Privado)";
    } else {
        document.getElementById('trial-context').innerHTML = "Cisterna llena (Fondo inicial de $1,000 MXN por vecino). De tus <strong>$1,000 MXN</strong> proporcionales, ¿cuánto retiras para ti y cuánto dejas en la cisterna?";
        document.getElementById('label-comun').innerText = "Dejar en Cisterna (Común)";
        document.getElementById('label-privado').innerText = "Retirar (Privado)";
    }
    state.startTime = performance.now();
}

document.addEventListener("DOMContentLoaded", () => {
    let inputComun = document.getElementById('input-comun');
    let inputPrivado = document.getElementById('input-privado');
    if(inputComun && inputPrivado) {
        inputComun.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault(); let val = parseInt(this.value) || 0;
                if(val >= 0 && val <= 1000) { inputPrivado.value = 1000 - val; validateSum(); }
            }
        });
        inputPrivado.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault(); let val = parseInt(this.value) || 0;
                if(val >= 0 && val <= 1000) { inputComun.value = 1000 - val; validateSum(); }
            }
        });
        inputComun.addEventListener('input', validateSum);
        inputPrivado.addEventListener('input', validateSum);
    }
});

function validateSum() {
    let inputComun = document.getElementById('input-comun'); let inputPrivado = document.getElementById('input-privado');
    let btn = document.getElementById('btn-confirm-trial'); let msg = document.getElementById('validation-msg');
    let v1 = parseInt(inputComun.value) || 0; let v2 = parseInt(inputPrivado.value) || 0;
    
    if (v1 + v2 === 1000 && inputComun.value !== "" && inputPrivado.value !== "") {
        if(btn) btn.disabled = false; if(msg) msg.classList.remove('visible');
    } else {
        if(btn) btn.disabled = true; if(msg) msg.classList.add('visible');
    }
}

function calcularPagoProvision(aporteUsuario, aportesBots) {
  const sumaBots = aportesBots.reduce((acc, curr) => acc + curr, 0);
  const fondoComunTotal = aporteUsuario + sumaBots;
  const fondoMultiplicado = fondoComunTotal * CONFIG.MULTIPLICADOR;
  const retornoIndividual = fondoMultiplicado / CONFIG.N_GRUPO; 
  const fondoPrivado = CONFIG.DOTACION_MENSUAL - aporteUsuario;
  const gananciaEnsayo = fondoPrivado + retornoIndividual;
  return { aporteUsuario, fondoPrivado, aportesBots, sumaBots, promedioBots: sumaBots / 3, fondoComunTotal, fondoMultiplicado, retornoIndividual, gananciaEnsayo };
}

function calcularPagoMantenimiento(retiroUsuario, retirosBots) {
  const sumaRetirosBots = retirosBots.reduce((acc, curr) => acc + curr, 0);
  const totalRetiros = retiroUsuario + sumaRetirosBots;
  const fondoRestanteCisterna = Math.max(0, CONFIG.VALOR_INICIAL_CISTERNA - totalRetiros);
  const fondoMultiplicado = fondoRestanteCisterna * CONFIG.MULTIPLICADOR;
  const retornoIndividual = fondoMultiplicado / CONFIG.N_GRUPO; 
  const fondoDejadoCisterna = CONFIG.DOTACION_MENSUAL - retiroUsuario;
  const gananciaEnsayo = retiroUsuario + retornoIndividual;
  return { retiroUsuario, fondoDejadoCisterna, retirosBots, sumaBots: sumaRetirosBots, promedioBots: sumaRetirosBots / 3, fondoComunTotal: fondoRestanteCisterna, fondoMultiplicado, retornoIndividual, gananciaEnsayo };
}

function calcularPagoPractica(ensayoNum, aporteUsuario) {
  let aportesBots = ensayoNum === 1 ? [1000, 1000, 1000] : ensayoNum === 2 ? [0, 0, 0] : [500, 750, 250];
  return calcularPagoProvision(aporteUsuario, aportesBots);
}

function confirmTrial() {
    let tr_ms = Math.round(performance.now() - state.startTime);
    let userValue = parseInt(document.getElementById('input-comun').value);
    let conservado = parseInt(document.getElementById('input-privado').value);
    
    let res; let botsDecisiones;
    let condicionActual = getActiveCondition();
    let decisionPrevia = state.currentTrialIndex > 0 ? state.coopHistory.user[state.coopHistory.user.length - 1] : null;

    if (state.currentPhase === 'practice') {
        res = calcularPagoPractica(state.currentTrialIndex + 1, userValue); botsDecisiones = res.aportesBots;
    } else if (condicionActual === 'provision') {
        botsDecisiones = generarDecisionesBots(state.profile, 'provision', state.currentTrialIndex + 1, decisionPrevia);
        res = calcularPagoProvision(userValue, botsDecisiones);
    } else {
        botsDecisiones = generarDecisionesBots(state.profile, 'mantenimiento', state.currentTrialIndex + 1, decisionPrevia);
        res = calcularPagoMantenimiento(userValue, botsDecisiones);
    }

    state.accumulatedWealth.user += res.gananciaEnsayo;
    state.accumulatedWealth.bot1 += (CONFIG.DOTACION_MENSUAL - botsDecisiones[0]) + res.retornoIndividual;
    state.accumulatedWealth.bot2 += (CONFIG.DOTACION_MENSUAL - botsDecisiones[1]) + res.retornoIndividual;
    state.accumulatedWealth.bot3 += (CONFIG.DOTACION_MENSUAL - botsDecisiones[2]) + res.retornoIndividual;

    state.coopHistory.user.push(userValue);
    state.coopHistory.bot1.push(botsDecisiones[0]);
    state.coopHistory.bot2.push(botsDecisiones[1]);
    state.coopHistory.bot3.push(botsDecisiones[2]);
    state.coopHistory.labels.push(`M${state.currentTrialIndex + 1}`);

    if(state.currentPhase !== 'practice') {
        state.trialData.push({
            bloque: state.currentPhase === 'block1' ? 1 : 2, tipo_dilema: condicionActual,
            aporte_publico: userValue, fondo_privado: conservado, tr_ms: tr_ms,
            bot1: botsDecisiones[0], bot2: botsDecisiones[1], bot3: botsDecisiones[2], ganancia: res.gananciaEnsayo
        });
    }

    renderDesglose(res, userValue, conservado);
    showScreen('screen-feedback');
}

function renderDesglose(res, userValue, conservado) {
    document.getElementById('fb-total-ganancia').innerText = `$${res.gananciaEnsayo.toFixed(1)} MXN`;
    document.getElementById('fb-privado').innerText = `$${conservado} MXN`;
    document.getElementById('fb-comun-total').innerText = `$${res.fondoComunTotal} MXN`;
    document.getElementById('fb-retorno').innerText = `$${res.retornoIndividual.toFixed(1)} MXN`;
    document.getElementById('fb-row-aporte').innerText = `$${userValue} MXN`;
    document.getElementById('fb-row-privado').innerText = `$${conservado} MXN`;
    document.getElementById('fb-row-vecinos').innerText = `$${res.sumaBots} MXN (Promedio: $${res.promedioBots.toFixed(1)} MXN)`;

    renderFeedbackCharts(res);
}

function nextPhase() {
    let totalTrials = (state.currentPhase === 'practice') ? CONFIG.ENSAYOS_POR_BLOQUE_TEST : CONFIG.ENSAYOS_POR_BLOQUE_FULL;
    state.currentTrialIndex++;
    if(state.currentTrialIndex < totalTrials) {
        loadTrialUI();
    } else {
        if(state.currentPhase === 'practice') initTransitionB1();
        else if(state.currentPhase === 'block1') showBlock1Results();
        else finishExperiment();
    }
}

function showBlock1Results() {
    showScreen('screen-block1-results');
    let g1 = state.trialData.filter(t => t.bloque === 1).reduce((acc, curr) => acc + curr.ganancia, 0);
    document.getElementById('break-ganancia').innerText = `$${g1.toFixed(1)} MXN`;
}

function renderFeedbackCharts(res) {
    let ctxWealth = document.getElementById('wealthChart').getContext('2d');
    let ctxCoop = document.getElementById('coopChart').getContext('2d');
    if(wealthChartInstance) wealthChartInstance.destroy(); if(coopChartInstance) coopChartInstance.destroy();

    wealthChartInstance = new Chart(ctxWealth, {
        type: 'bar',
        data: {
            labels: ['Tú', 'Vecino 1', 'Vecino 2', 'Vecino 3'],
            datasets: [{ label: 'Ganancia Acumulada ($)', data: [state.accumulatedWealth.user, state.accumulatedWealth.bot1, state.accumulatedWealth.bot2, state.accumulatedWealth.bot3], backgroundColor: ['#A07EE8', '#EAE0F5', '#EAE0F5', '#EAE0F5'] }]
        },
        options: { responsive: true, plugins: { title: { display: true, text: 'Riqueza Acumulada del Bloque' } } }
    });

    coopChartInstance = new Chart(ctxCoop, {
        type: 'line',
        data: {
            labels: state.coopHistory.labels,
            datasets: [
                { label: 'Tu aportación', data: state.coopHistory.user, borderColor: '#A07EE8', backgroundColor: '#A07EE8', tension: 0.3, borderWidth: 3 },
                { label: 'Vecino 1', data: state.coopHistory.bot1, borderColor: '#F48FB1', backgroundColor: '#F48FB1', borderDash: [4, 4], tension: 0.3, borderWidth: 2 },
                { label: 'Vecino 2', data: state.coopHistory.bot2, borderColor: '#8ECAE6', backgroundColor: '#8ECAE6', borderDash: [4, 4], tension: 0.3, borderWidth: 2 },
                { label: 'Vecino 3', data: state.coopHistory.bot3, borderColor: '#BDBDBD', backgroundColor: '#BDBDBD', borderDash: [4, 4], tension: 0.3, borderWidth: 2 }
            ]
        },
        options: { responsive: true, scales: { y: { min: 0, max: 1000 } }, plugins: { title: { display: true, text: `Historial de Cooperación Individual - Bloque ${state.currentPhase === 'block1' ? 'I' : 'II'}` } } }
    });
}

function initBreak() {
    showScreen('screen-break');
    let btn = document.getElementById('btn-end-break'); let timerEl = document.getElementById('break-timer');
    if(btn) { btn.disabled = true; btn.classList.add('disabled'); }
    
    let timeLeft = CONFIG.TIEMPO_DESCANSO_FULL_SEG;
    let interval = setInterval(() => {
        let m = String(Math.floor(timeLeft / 60)).padStart(2, '0'); let s = String(timeLeft % 60).padStart(2, '0');
        if(timerEl) timerEl.innerText = `${m}:${s}`;
        if(timeLeft <= 0) { clearInterval(interval); if(btn) { btn.disabled = false; btn.classList.remove('disabled'); } if(timerEl) timerEl.innerText = "00:00"; }
        timeLeft--;
    }, 1000);
}

function getLocalDB() {
    let db = localStorage.getItem('bienes_publicos_db'); return db ? JSON.parse(db) : [];
}

function finishExperiment() {
    showScreen('screen-end');
    
    let g1 = state.trialData.filter(t => t.bloque === 1).reduce((acc, curr) => acc + curr.ganancia, 0);
    let g2 = state.trialData.filter(t => t.bloque === 2).reduce((acc, curr) => acc + curr.ganancia, 0);
    let gTotal = g1 + g2;
    document.getElementById('end-ganancia').innerText = `$${gTotal.toFixed(1)} MXN`;

    let scores = [ { name: 'Tú', score: state.accumulatedWealth.user }, { name: 'Vecino 1', score: state.accumulatedWealth.bot1 }, { name: 'Vecino 2', score: state.accumulatedWealth.bot2 }, { name: 'Vecino 3', score: state.accumulatedWealth.bot3 } ];
    scores.sort((a, b) => b.score - a.score);
    let winner = scores[0];
    let announcement = document.getElementById('winner-announcement');
    if (winner.name === 'Tú') announcement.innerText = `🏆 ¡Felicidades! Fuiste el vecino que más dinero acumuló.`;
    else announcement.innerText = `🏆 El ${winner.name} acumuló la mayor cantidad de dinero.`;

    let ctxFinal = document.getElementById('finalChart').getContext('2d');
    if(finalChartInstance) finalChartInstance.destroy();
    finalChartInstance = new Chart(ctxFinal, {
        type: 'bar',
        data: { labels: ['Tú', 'Vecino 1', 'Vecino 2', 'Vecino 3'], datasets: [{ label: 'Ganancia Total Acumulada', data: [state.accumulatedWealth.user, state.accumulatedWealth.bot1, state.accumulatedWealth.bot2, state.accumulatedWealth.bot3], backgroundColor: ['#7B55D3', '#D1C4E9', '#D1C4E9', '#D1C4E9'] }] },
        options: { responsive: true, plugins: { legend: { display: false }, title: {display: true, text: "Ganancias Finales de Todo el Condominio"} } }
    });

    let provData = state.trialData.filter(t => t.tipo_dilema === 'provision'); let mantData = state.trialData.filter(t => t.tipo_dilema === 'mantenimiento');
    let avgProvUser = provData.length > 0 ? (provData.reduce((acc, t) => acc + t.aporte_publico, 0) / provData.length) : 0;
    let avgMantUser = mantData.length > 0 ? (mantData.reduce((acc, t) => acc + t.aporte_publico, 0) / mantData.length) : 0;
    let avgProvBots = provData.length > 0 ? (provData.reduce((acc, t) => acc + ((t.bot1+t.bot2+t.bot3)/3), 0) / provData.length) : 0;
    let avgMantBots = mantData.length > 0 ? (mantData.reduce((acc, t) => acc + ((t.bot1+t.bot2+t.bot3)/3), 0) / mantData.length) : 0;

    let ctxAvg = document.getElementById('avgCoopChart').getContext('2d');
    if(avgCoopChartInstance) avgCoopChartInstance.destroy();
    avgCoopChartInstance = new Chart(ctxAvg, {
        type: 'bar',
        data: { labels: ['Provisión', 'Mantenimiento'], datasets: [ { label: 'Promedio Tu Aportación', data: [avgProvUser, avgMantUser], backgroundColor: '#A07EE8' }, { label: 'Promedio Vecinos', data: [avgProvBots, avgMantBots], backgroundColor: '#F48FB1' } ] },
        options: { responsive: true, scales: { y: { min: 0, max: 1000 } }, plugins: { title: { display: true, text: 'Promedio de Cooperación por Condición' } } }
    });

    // Construcción Dinámica de la Fila (Wide Format)
    let participantRow = {};
    CSV_HEADERS.forEach(h => participantRow[h] = ""); 

    participantRow.participante = state.participantId; participantRow.edad = state.metadata.age; participantRow.genero = state.metadata.gender;
    participantRow.carrera = state.metadata.career; participantRow.participacion_previa = state.metadata.prev;
    participantRow.orden_bloques = state.order; participantRow.perfil_vecinos = state.profile;

    state.trialData.forEach((t, i) => {
        let num = i + 1; 
        participantRow[`ensayo_${num}_bloque`] = t.bloque; participantRow[`ensayo_${num}_condicion`] = t.tipo_dilema;
        participantRow[`ensayo_${num}_aporte_publico`] = t.aporte_publico; participantRow[`ensayo_${num}_fondo_privado`] = t.fondo_privado;
        participantRow[`ensayo_${num}_tr_ms`] = t.tr_ms; participantRow[`ensayo_${num}_bot1`] = t.bot1;
        participantRow[`ensayo_${num}_bot2`] = t.bot2; participantRow[`ensayo_${num}_bot3`] = t.bot3; participantRow[`ensayo_${num}_ganancia`] = t.ganancia;
    });

    participantRow.ganancia_b1 = g1; participantRow.ganancia_b2 = g2; participantRow.ganancia_total = gTotal;

    // Guardado Local
    let db = getLocalDB(); db.push(participantRow); localStorage.setItem('bienes_publicos_db', JSON.stringify(db));

    // Envío a Google Sheets (En modo 'no-cors' con 'text/plain' evita el bloqueo)
    if(GOOGLE_WEB_APP_URL && GOOGLE_WEB_APP_URL.includes("script.google.com")) {
        fetch(GOOGLE_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(participantRow)
        }).then(() => console.log("Datos enviados a la nube.")).catch(err => console.error("Error:", err));
    }
}

function exportAccumulatedDB() {
    let db = getLocalDB();
    if(db.length === 0) { alert("No hay datos registrados en esta computadora."); return; }
    
    let csvContent = "data:text/csv;charset=utf-8," + CSV_HEADERS.join(",") + "\n" + 
        db.map(row => CSV_HEADERS.map(h => {
            let val = row[h]; return (val === null || val === undefined) ? '' : String(val).replace(/,/g, ''); 
        }).join(",")).join("\n");
        
    let encodedUri = encodeURI(csvContent); let link = document.createElement("a"); link.setAttribute("href", encodedUri);
    link.setAttribute("download", "BASE_ACUMULADA_WIDE.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function clearAccumulatedDB() {
    if(confirm("ATENCIÓN: Esto borrará la base de datos de esta computadora. ¿Deseas continuar?")) {
        localStorage.removeItem('bienes_publicos_db'); alert("Base de datos local eliminada.");
    }
}

window.iniciarDesdeBienvenida = iniciarDesdeBienvenida; window.startExperimentSetup = startExperimentSetup; window.startPractice = startPractice;
window.confirmTrial = confirmTrial; window.nextPhase = nextPhase; window.startBlock2 = startBlock2;
window.exportAccumulatedDB = exportAccumulatedDB; window.clearAccumulatedDB = clearAccumulatedDB; window.initBreak = initBreak;
