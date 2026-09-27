// --- CONFIGURACIÓN DE NUBE ---
// PEGA AQUÍ LA URL DE TU GOOGLE APPS SCRIPT:
const GOOGLE_WEB_APP_URL = "URL_DE_TU_GOOGLE_SCRIPT_AQUI";

// --- ESTADO GLOBAL DEL EXPERIMENTO ---
let state = {
    mode: 'full', 
    trialsPerBlock: 10,
    breakTime: 60, 
    participantId: '',
    metadata: {},
    order: '', 
    profile: '', 
    currentPhase: 'practice', 
    currentTrialIndex: 0,
    startTime: 0,
    trialData: [],
    accumulatedWealth: { user: 0, bot1: 0, bot2: 0, bot3: 0 },
    coopHistory: { user: [], botsAvg: [], labels: [] }
};

let wealthChartInstance = null;
let coopChartInstance = null;

// --- INICIALIZACIÓN ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function startExperimentSetup() {
    let age = document.getElementById('demo-age').value;
    let gender = document.getElementById('demo-gender').value;
    let career = document.getElementById('demo-career').value;
    let prev = document.getElementById('demo-prev').value;
    
    if(!age || !gender || !career || !prev) {
        alert("Por favor, completa todos los campos sociodemográficos.");
        return;
    }

    state.mode = document.getElementById('config-mode').value;
    state.trialsPerBlock = state.mode === 'full' ? 10 : 3;
    state.breakTime = state.mode === 'full' ? 60 : 10;
    
    // Asignar ID basado en un número aleatorio de 4 dígitos para evitar duplicidad entre dispositivos
    state.participantId = 'P-' + Math.floor(1000 + Math.random() * 9000);
    
    state.order = Math.random() > 0.5 ? 'PR_MA' : 'MA_PR';
    let profiles = ['polizones', 'condicionales', 'incondicionales'];
    state.profile = profiles[Math.floor(Math.random() * profiles.length)];
    
    state.metadata = { age, gender, career, prev };
    showScreen('screen-instructions');
}

// --- FLUJO DE ENSAYOS ---
function startPractice() {
    state.currentPhase = 'practice';
    state.currentTrialIndex = 0;
    loadTrialUI();
}

function startBlock1() {
    state.currentPhase = 'block1';
    state.currentTrialIndex = 0;
    state.accumulatedWealth = { user: 0, bot1: 0, bot2: 0, bot3: 0 };
    state.coopHistory = { user: [], botsAvg: [], labels: [] };
    loadTrialUI();
}

function startBlock2() {
    state.currentPhase = 'block2';
    state.currentTrialIndex = 0;
    state.accumulatedWealth = { user: 0, bot1: 0, bot2: 0, bot3: 0 };
    state.coopHistory = { user: [], botsAvg: [], labels: [] };
    loadTrialUI();
}

function loadTrialUI() {
    showScreen('screen-trial');
    document.getElementById('input-comun').value = '';
    document.getElementById('input-privado').value = '';
    document.getElementById('btn-confirm-trial').disabled = true;
    document.getElementById('validation-msg').classList.remove('visible');
    
    let totalTrials = state.currentPhase === 'practice' ? 3 : state.trialsPerBlock;
    let condition = getActiveCondition();
    
    document.getElementById('trial-counter').innerText = 
        `${state.currentPhase === 'practice' ? 'Práctica' : 'Mes'} ${state.currentTrialIndex + 1} de ${totalTrials}`;
    document.getElementById('trial-condition-label').innerText = 
        `Condición: ${state.currentPhase === 'practice' ? 'Paneles Solares' : condition.toUpperCase()}`;
    
    if(state.currentPhase === 'practice') {
        document.getElementById('trial-context').innerText = "Contexto: Instalación de paneles solares en área común. ¿Cuánto de tus $1,000 aportas al fondo de paneles y cuánto dejas para ti?";
        document.getElementById('label-comun').innerText = "Fondo Paneles (Común)";
        document.getElementById('label-privado').innerText = "Cuenta Privada";
    } else if(condition === 'provision') {
        document.getElementById('trial-context').innerText = "Condominio sin cisterna (0% agua). Subsidio de $1,000 MXN. ¿Cuánto aportas al fondo común para construir la cisterna y cuánto conservas en tu cuenta?";
        document.getElementById('label-comun').innerText = "Aportar a Cisterna (Común)";
        document.getElementById('label-privado').innerText = "Conservar (Privado)";
    } else {
        document.getElementById('trial-context').innerText = "Cisterna llena (Fondo común inicial $1,000 por vecino). ¿Cuánto retiras para tu uso exclusivo y cuánto dejas en la cisterna?";
        document.getElementById('label-comun').innerText = "Dejar en Cisterna (Común)";
        document.getElementById('label-privado').innerText = "Retirar (Privado)";
    }

    state.startTime = performance.now();
}

// --- INTERACCIÓN Y VALIDACIÓN ---
let inputComun = document.getElementById('input-comun');
let inputPrivado = document.getElementById('input-privado');

inputComun.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        let val = parseInt(this.value) || 0;
        if(val >= 0 && val <= 1000) {
            inputPrivado.value = 1000 - val;
            validateSum();
        }
    }
});

inputComun.addEventListener('input', validateSum);

function validateSum() {
    let v1 = parseInt(inputComun.value) || 0;
    let v2 = parseInt(inputPrivado.value) || 0;
    let btn = document.getElementById('btn-confirm-trial');
    let msg = document.getElementById('validation-msg');
    
    if (v1 + v2 === 1000 && inputComun.value !== "") {
        btn.disabled = false;
        msg.classList.remove('visible');
    } else {
        btn.disabled = true;
        msg.classList.add('visible');
    }
}

// --- LÓGICA DE BOTS Y CÁLCULOS ---
function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function calculateBotCooperation() {
    if(state.profile === 'polizones') {
        return [getRandomInt(0, 100), getRandomInt(0, 100), getRandomInt(0, 100)];
    }
    if(state.profile === 'incondicionales') {
        return [getRandomInt(700, 800), getRandomInt(700, 800), getRandomInt(700, 800)];
    }
    if(state.profile === 'condicionales') {
        let lastCoop = 500;
        if(state.currentTrialIndex > 0) {
            let pastTrials = state.trialData.filter(t => t.bloque === (state.currentPhase === 'block1' ? 1 : 2));
            lastCoop = pastTrials[pastTrials.length - 1].aporte_coop;
        }
        return [lastCoop, lastCoop, lastCoop];
    }
}

function confirmTrial() {
    let tr_ms = Math.round(performance.now() - state.startTime);
    let userCoop = parseInt(inputComun.value);
    let userPrivate = parseInt(inputPrivado.value);
    
    let botsCoop = calculateBotCooperation();
    let totalCommon = userCoop + botsCoop[0] + botsCoop[1] + botsCoop[2];
    let commonReturn = (totalCommon * 1.5) / 4;
    
    let userProfit = userPrivate + commonReturn;
    let b1Profit = (1000 - botsCoop[0]) + commonReturn;
    let b2Profit = (1000 - botsCoop[1]) + commonReturn;
    let b3Profit = (1000 - botsCoop[2]) + commonReturn;

    state.accumulatedWealth.user += userProfit;
    state.accumulatedWealth.bot1 += b1Profit;
    state.accumulatedWealth.bot2 += b2Profit;
    state.accumulatedWealth.bot3 += b3Profit;

    let avgBots = (botsCoop[0] + botsCoop[1] + botsCoop[2]) / 3;
    state.coopHistory.user.push(userCoop);
    state.coopHistory.botsAvg.push(avgBots);
    state.coopHistory.labels.push(`M${state.currentTrialIndex + 1}`);

    if(state.currentPhase !== 'practice') {
        state.trialData.push({
            bloque: state.currentPhase === 'block1' ? 1 : 2,
            tipo_dilema: getActiveCondition(),
            aporte_coop: userCoop,
            fondo_privado: userPrivate,
            tr_ms: tr_ms,
            bot1: botsCoop[0],
            bot2: botsCoop[1],
            bot3: botsCoop[2],
            ganancia: userProfit
        });
    }

    renderFeedbackCharts();
    showScreen('screen-feedback');
}

function getActiveCondition() {
    if(state.order === 'PR_MA') return state.currentPhase === 'block1' ? 'provision' : 'mantenimiento';
    return state.currentPhase === 'block1' ? 'mantenimiento' : 'provision';
}

function nextPhase() {
    let totalTrials = state.currentPhase === 'practice' ? 3 : state.trialsPerBlock;
    state.currentTrialIndex++;
    
    if(state.currentTrialIndex < totalTrials) {
        loadTrialUI();
    } else {
        if(state.currentPhase === 'practice') {
            startBlock1();
        } else if(state.currentPhase === 'block1') {
            initBreak();
        } else {
            finishExperiment();
        }
    }
}

// --- GRÁFICAS (CHART.JS) ---
function renderFeedbackCharts() {
    let ctxWealth = document.getElementById('wealthChart').getContext('2d');
    let ctxCoop = document.getElementById('coopChart').getContext('2d');

    if(wealthChartInstance) wealthChartInstance.destroy();
    if(coopChartInstance) coopChartInstance.destroy();

    wealthChartInstance = new Chart(ctxWealth, {
        type: 'bar',
        data: {
            labels: ['Tú', 'Vecino 1', 'Vecino 2', 'Vecino 3'],
            datasets: [{
                label: 'Ganancia Acumulada ($)',
                data: [state.accumulatedWealth.user, state.accumulatedWealth.bot1, state.accumulatedWealth.bot2, state.accumulatedWealth.bot3],
                backgroundColor: ['#9D7BE8', '#EAE0F5', '#EAE0F5', '#EAE0F5']
            }]
        },
        options: { responsive: true, plugins: { title: { display: true, text: 'Riqueza Total Acumulada en el Bloque' } } }
    });

    coopChartInstance = new Chart(ctxCoop, {
        type: 'line',
        data: {
            labels: state.coopHistory.labels,
            datasets: [
                { label: 'Tu aportación', data: state.coopHistory.user, borderColor: '#9D7BE8', backgroundColor: '#9D7BE8', tension: 0.3 },
                { label: 'Promedio Vecinos', data: state.coopHistory.botsAvg, borderColor: '#F48FB1', backgroundColor: '#F48FB1', borderDash: [5, 5], tension: 0.3 }
            ]
        },
        options: { responsive: true, scales: { y: { min: 0, max: 1000 } }, plugins: { title: { display: true, text: 'Historial de Cooperación' } } }
    });
}

// --- DESCANSO ---
function initBreak() {
    showScreen('screen-break');
    let btn = document.getElementById('btn-end-break');
    let timerEl = document.getElementById('break-timer');
    btn.disabled = true;
    btn.classList.add('disabled');
    
    let timeLeft = state.breakTime;
    
    let interval = setInterval(() => {
        let m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
        let s = String(timeLeft % 60).padStart(2, '0');
        timerEl.innerText = `${m}:${s}`;
        
        if(timeLeft <= 0) {
            clearInterval(interval);
            btn.disabled = false;
            btn.classList.remove('disabled');
            timerEl.innerText = "00:00";
        }
        timeLeft--;
    }, 1000);
}

// --- GESTIÓN DE DATOS ACUMULATIVOS EN LA NUBE Y LOCAL ---
function getLocalDB() {
    let db = localStorage.getItem('bienes_publicos_db');
    return db ? JSON.parse(db) : [];
}

function finishExperiment() {
    showScreen('screen-end');
    
    let g1 = state.trialData.filter(t=>t.bloque===1).reduce((acc, curr) => acc + curr.ganancia, 0);
    let g2 = state.trialData.filter(t=>t.bloque===2).reduce((acc, curr) => acc + curr.ganancia, 0);

    let participantRow = {
        participante: state.participantId,
        edad: state.metadata.age,
        genero: state.metadata.gender,
        carrera_profesion: state.metadata.career,
        participacion_previa: state.metadata.prev,
        orden_bloques: state.order,
        perfil_vecindario: state.profile
    };

    // Construcción del formato Wide
    for(let i=0; i<20; i++) {
        let t = state.trialData[i];
        let prefix = `ensayo_${i+1}_`;
        participantRow[prefix+'bloque'] = t ? t.bloque : '';
        participantRow[prefix+'tipo_dilema'] = t ? t.tipo_dilema : '';
        participantRow[prefix+'aporte'] = t ? t.aporte_coop : '';
        participantRow[prefix+'fondo_privado'] = t ? t.fondo_privado : '';
        participantRow[prefix+'tr_ms'] = t ? t.tr_ms : '';
        participantRow[prefix+'bot1'] = t ? t.bot1 : '';
        participantRow[prefix+'bot2'] = t ? t.bot2 : '';
        participantRow[prefix+'bot3'] = t ? t.bot3 : '';
        participantRow[prefix+'ganancia'] = t ? t.ganancia : '';
    }
    
    participantRow['ganancia_total_bloque1'] = g1;
    participantRow['ganancia_total_bloque2'] = g2;
    participantRow['ganancia_total_global'] = g1 + g2;

    // 1. Guardado de Respaldo Local (Por si falla internet)
    let db = getLocalDB();
    db.push(participantRow);
    localStorage.setItem('bienes_publicos_db', JSON.stringify(db));

    // 2. Envío Silencioso a Google Sheets (Sin descargar automáticamente)
    if(GOOGLE_WEB_APP_URL !== "URL_DE_TU_GOOGLE_SCRIPT_AQUI") {
        fetch(GOOGLE_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors', // Evita bloqueos de seguridad del navegador
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(participantRow)
        }).catch(err => console.log("Error al enviar a la nube:", err));
    }
}

// Funciones llamadas únicamente por el botón sutil del pie de página
function exportAccumulatedDB() {
    let db = getLocalDB();
    if(db.length === 0) { alert("No hay datos locales registrados."); return; }

    let headers = Object.keys(db[0]);
    let csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + db.map(row => headers.map(h => row[h]).join(",")).join("\n");

    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "BASE_DATOS_LOCAL_DILEMA.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function clearAccumulatedDB() {
    if(confirm("¿Estás seguro de que deseas ELIMINAR los datos de respaldo en esta computadora?")) {
        localStorage.removeItem('bienes_publicos_db');
        alert("Respaldo local limpiado exitosamente.");
    }
}