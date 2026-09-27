JavaScript
/**
 * Motor Experimental y Lógica de Teoría de Juegos
 * Proyecto: Tarea Computarizada de Dilema de Bienes Públicos: Gestión de Agua en Condominios
 * UNAM - Facultad de Psicología - Laboratorio de psicofisica social, interacción y automatización
 * Investigadora Principal: Atzin Citlalli Zavala García
 */

 const CONFIG = {
  N_GRUPO: 4,               // 1 participante + 3 bots
  MULTIPLICADOR: 1.5,       // Factor de multiplicación del fondo común
  MPCR: 0.375,              // Multiplicador / N_GRUPO = 1.5 / 4
  DOTACION_MENSUAL: 1000,   // $1,000 MXN por ensayo
  VALOR_INICIAL_CISTERNA: 4000, // $4,000 MXN en condición de mantenimiento
  ENSAYOS_POR_BLOQUE_FULL: 10,
  ENSAYOS_POR_BLOQUE_TEST: 3,
  TIEMPO_TRANSICION_SEG: 10,
  TIEMPO_DESCANSO_FULL_SEG: 60, // 1 minuto
  TIEMPO_DESCANSO_TEST_SEG: 10   // 10 segundos para modo de prueba rápida
};

// URL de Google Apps Script
const GOOGLE_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzk77Op3xSqr5hieKZN-RR0mx-i7vpDPGTzcxlaxml7O5-yNF3KYyjbTKR-TY_O8LPyBA/exec";

let state = {
    participantId: '',
    metadata: {},
    order: '',          // Contrabalanceo ('PR_MA' o 'MA_PR')
    profile: '',        // 'polizones' | 'incondicionales' | 'condicionales'
    currentPhase: 'practice', // 'practice', 'block1', 'block2'
    currentTrialIndex: 0,
    startTime: 0,
    trialData: [],
    accumulatedWealth: { user: 0, bot1: 0, bot2: 0, bot3: 0 },
    coopHistory: { user: [], botsAvg: [], labels: [] }
};

let wealthChartInstance = null;
let coopChartInstance = null;

// Control de pantallas
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    let header = document.getElementById('global-header');
    if (header) {
        if (id === 'screen-welcome') {
            header.classList.add('hidden-header');
        } else {
            header.classList.remove('hidden-header');
        }
    }
}

function iniciarDesdeBienvenida() {
    showScreen('screen-demographics');
}

function startExperimentSetup() {
    let age = document.getElementById('demo-age').value;
    let gender = document.getElementById('demo-gender').value;
    let career = document.getElementById('demo-career').value;
    let prev = document.getElementById('demo-prev').value;
    
    if(!age || !gender || !career || !prev) {
        alert("⚠️ Por favor, completa todos los campos sociodemográficos. Asegúrate de elegir una opción en los menús desplegables.");
        return; // Esto es lo que detiene el avance
    }

    state.participantId = 'P-' + Math.floor(1000 + Math.random() * 9000);
    state.order = Math.random() > 0.5 ? 'PR_MA' : 'MA_PR';
    
    let profiles = ['polizones', 'condicionales', 'incondicionales'];
    state.profile = profiles[Math.floor(Math.random() * profiles.length)];
    
    state.metadata = { age, gender, career, prev };
    showScreen('screen-instructions');
}

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
    loadTrialUI();
}

/**
 * Generador de números aleatorios con distribución normal (Gaussiana)
 * Utiliza la transformada de Box-Muller
 */
 function normalRandom(mean, stdDev, min = null, max = null) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); 
  while (v === 0) v = Math.random();
  
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  let value = mean + z * stdDev;
  
  if (min !== null) value = Math.max(min, value);
  if (max !== null) value = Math.min(max, value);
  
  return Math.round(value);
}

/**
 * Genera las decisiones de los 3 vecinos bots para un ensayo
 */
 function generarDecisionesBots(perfil, tipoDilema, numeroEnsayo, decisionPreviaUsuario = null) {
  const bots = [];

  for (let i = 0; i < 3; i++) {
    let valor = 0;
    
    if (perfil === 'polizones') {
      if (tipoDilema === 'provision') {
        valor = normalRandom(50, 25, 0, 100);
      } else {
        valor = normalRandom(950, 25, 900, 1000);
      }
    } else if (perfil === 'incondicionales') {
      if (tipoDilema === 'provision') {
        valor = normalRandom(750, 30, 700, 800);
      } else {
        valor = normalRandom(250, 30, 200, 300);
      }
    } else if (perfil === 'condicionales') {
      if (numeroEnsayo === 1 || decisionPreviaUsuario === null) {
        valor = normalRandom(500, 40, 0, 1000);
      } else {
        valor = normalRandom(decisionPreviaUsuario, 45, 0, 1000);
      }
    }
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
    let inputComun = document.getElementById('input-comun');
    let inputPrivado = document.getElementById('input-privado');
    
    if(inputComun) inputComun.value = '';
    if(inputPrivado) inputPrivado.value = '';
    
    let btnConfirm = document.getElementById('btn-confirm-trial');
    if(btnConfirm) btnConfirm.disabled = true;
    
    let msg = document.getElementById('validation-msg');
    if(msg) msg.classList.remove('visible');
    
    let totalTrials = (state.currentPhase === 'practice') ? CONFIG.ENSAYOS_POR_BLOQUE_TEST : CONFIG.ENSAYOS_POR_BLOQUE_FULL;
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

// Configuración de inputs y validación por Tab
document.addEventListener("DOMContentLoaded", () => {
    let inputComun = document.getElementById('input-comun');
    let inputPrivado = document.getElementById('input-privado');

    if(inputComun && inputPrivado) {
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
    }
});

function validateSum() {
    let inputComun = document.getElementById('input-comun');
    let inputPrivado = document.getElementById('input-privado');
    let btn = document.getElementById('btn-confirm-trial');
    let msg = document.getElementById('validation-msg');
    
    let v1 = parseInt(inputComun.value) || 0;
    let v2 = parseInt(inputPrivado.value) || 0;
    
    if (v1 + v2 === 1000 && inputComun.value !== "") {
        if(btn) btn.disabled = false;
        if(msg) msg.classList.remove('visible');
    } else {
        if(btn) btn.disabled = true;
        if(msg) msg.classList.add('visible');
    }
}

/**
 * Cálculo del pago individual para la condición de Provisión
 */
 function calcularPagoProvision(aporteUsuario, aportesBots) {
  const sumaBots = aportesBots.reduce((acc, curr) => acc + curr, 0);
  const fondoComunTotal = aporteUsuario + sumaBots;
  const fondoMultiplicado = fondoComunTotal * CONFIG.MULTIPLICADOR;
  const retornoIndividual = fondoMultiplicado / CONFIG.N_GRUPO; 
  const fondoPrivado = CONFIG.DOTACION_MENSUAL - aporteUsuario;
  const gananciaEnsayo = fondoPrivado + retornoIndividual;

  return {
    aporteUsuario,
    fondoPrivado,
    aportesBots,
    sumaBots,
    promedioBots: sumaBots / 3,
    fondoComunTotal,
    fondoMultiplicado,
    retornoIndividual,
    gananciaEnsayo
  };
}

/**
 * Cálculo del pago individual para la condición de Mantenimiento
 */
 function calcularPagoMantenimiento(retiroUsuario, retirosBots) {
  const sumaRetirosBots = retirosBots.reduce((acc, curr) => acc + curr, 0);
  const totalRetiros = retiroUsuario + sumaRetirosBots;
  const fondoRestanteCisterna = Math.max(0, CONFIG.VALOR_INICIAL_CISTERNA - totalRetiros);
  const fondoMultiplicado = fondoRestanteCisterna * CONFIG.MULTIPLICADOR;
  const retornoIndividual = fondoMultiplicado / CONFIG.N_GRUPO; 
  const fondoDejadoCisterna = CONFIG.DOTACION_MENSUAL - retiroUsuario;
  const gananciaEnsayo = retiroUsuario + retornoIndividual;

  return {
    retiroUsuario,
    fondoDejadoCisterna,
    retirosBots,
    sumaBots: sumaRetirosBots,
    promedioBots: sumaRetirosBots / 3,
    fondoComunTotal: fondoRestanteCisterna,
    fondoMultiplicado,
    retornoIndividual,
    gananciaEnsayo
  };
}

/**
 * Cálculo para los ensayos de práctica (Paneles Solares)
 */
 function calcularPagoPractica(ensayoNum, aporteUsuario) {
  let aportesBots = [];
  if (ensayoNum === 1) {
    aportesBots = [1000, 1000, 1000];
  } else if (ensayoNum === 2) {
    aportesBots = [0, 0, 0];
  } else {
    aportesBots = [500, 750, 250];
  }

  return calcularPagoProvision(aporteUsuario, aportesBots);
}

function confirmTrial() {
    let tr_ms = Math.round(performance.now() - state.startTime);
    let userValue = parseInt(document.getElementById('input-comun').value);
    
    let res;
    let botsDecisiones;
    let condicionActual = getActiveCondition();

    let decisionPrevia = state.currentTrialIndex > 0 ? state.coopHistory.user[state.coopHistory.user.length - 1] : null;

    if (state.currentPhase === 'practice') {
        res = calcularPagoPractica(state.currentTrialIndex + 1, userValue);
        botsDecisiones = res.aportesBots;
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
    state.coopHistory.botsAvg.push(res.promedioBots);
    state.coopHistory.labels.push(`M${state.currentTrialIndex + 1}`);

    if(state.currentPhase !== 'practice') {
        let filaEnsayo = {
            participante: state.participantId,
            edad: state.metadata.age,
            genero: state.metadata.gender,
            carrera_profesion: state.metadata.career,
            participacion_previa: state.metadata.prev,
            orden_bloques: state.order,
            perfil_vecindario: state.profile,
            ensayo: state.currentTrialIndex + 1,
            bloque: state.currentPhase === 'block1' ? 1 : 2,
            tipo_dilema: condicionActual,
            aporte_provision: condicionActual === 'provision' ? userValue : '',
            fondo_privado_provision: condicionActual === 'provision' ? res.fondoPrivado : '',
            tr_provision_ms: condicionActual === 'provision' ? tr_ms : '',
            aporte_bot1_provision: condicionActual === 'provision' ? botsDecisiones[0] : '',
            aporte_bot2_provision: condicionActual === 'provision' ? botsDecisiones[1] : '',
            aporte_bot3_provision: condicionActual === 'provision' ? botsDecisiones[2] : '',
            retiro_mantenimiento: condicionActual === 'mantenimiento' ? userValue : '',
            fondo_privado_mantenimiento: condicionActual === 'mantenimiento' ? res.fondoDejadoCisterna : '',
            tr_mantenimiento_ms: condicionActual === 'mantenimiento' ? tr_ms : '',
            retiro_bot1_mantenimiento: condicionActual === 'mantenimiento' ? botsDecisiones[0] : '',
            retiro_bot2_mantenimiento: condicionActual === 'mantenimiento' ? botsDecisiones[1] : '',
            retiro_bot3_mantenimiento: condicionActual === 'mantenimiento' ? botsDecisiones[2] : '',
            ganancia_ensayo: res.gananciaEnsayo,
            ganancia_total_bloque: '',
            ganancia_total_global: ''
        };
        state.trialData.push(filaEnsayo);
    }

    renderFeedbackCharts(res);
    showScreen('screen-feedback');
}

function nextPhase() {
    let totalTrials = (state.currentPhase === 'practice') ? CONFIG.ENSAYOS_POR_BLOQUE_TEST : CONFIG.ENSAYOS_POR_BLOQUE_FULL;
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

function renderFeedbackCharts(res) {
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
                data: [
                    state.accumulatedWealth.user, 
                    state.accumulatedWealth.bot1, 
                    state.accumulatedWealth.bot2, 
                    state.accumulatedWealth.bot3
                ],
                backgroundColor: ['#9D7BE8', '#EAE0F5', '#EAE0F5', '#EAE0F5']
            }]
        },
        options: { responsive: true, plugins: { title: { display: true, text: 'Riqueza Total Acumulada' } } }
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

function initBreak() {
    showScreen('screen-break');
    let btn = document.getElementById('btn-end-break');
    let timerEl = document.getElementById('break-timer');
    if(btn) {
        btn.disabled = true;
        btn.classList.add('disabled');
    }
    
    let timeLeft = CONFIG.TIEMPO_DESCANSO_FULL_SEG;
    
    let interval = setInterval(() => {
        let m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
        let s = String(timeLeft % 60).padStart(2, '0');
        if(timerEl) timerEl.innerText = `${m}:${s}`;
        
        if(timeLeft <= 0) {
            clearInterval(interval);
            if(btn) {
                btn.disabled = false;
                btn.classList.remove('disabled');
            }
            if(timerEl) timerEl.innerText = "00:00";
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
    
    let g1 = state.trialData.filter(t => t.bloque === 1).reduce((acc, curr) => acc + curr.ganancia_ensayo, 0);
    let g2 = state.trialData.filter(t => t.bloque === 2).reduce((acc, curr) => acc + curr.ganancia_ensayo, 0);
    let gTotal = g1 + g2;

    // Crear una fila por cada ensayo (Formato Largo/Long para facilitar el análisis)
    state.trialData.forEach(t => {
        t.ganancia_total_bloque = (t.bloque === 1) ? g1 : g2;
        t.ganancia_total_global = gTotal;
    });

    // 1. Guardar en el almacenamiento del navegador (Local Storage) de forma acumulativa
    let db = getLocalDB();
    // Añadimos todos los ensayos de este participante a la base maestra local
    db = db.concat(state.trialData);
    localStorage.setItem('bienes_publicos_db', JSON.stringify(db));

    // 2. Envío silencioso a Google Sheets (Nube)
    if(GOOGLE_WEB_APP_URL && GOOGLE_WEB_APP_URL.includes("script.google.com")) {
        // Se envía cada ensayo a la base de datos en la nube
        state.trialData.forEach(filaEnsayo => {
            fetch(GOOGLE_WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filaEnsayo)
            }).catch(err => console.log("Error de conexión:", err));
        });
    }
}

// --- FUNCIONES DEL FOOTER ADMINISTRATIVO ---
function exportAccumulatedDB() {
    let db = getLocalDB();
    if(db.length === 0) { 
        alert("No hay datos registrados en esta computadora."); 
        return; 
    }

    let headers = Object.keys(db[0]);
    let csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + db.map(row => headers.map(h => {
            let val = row[h];
            if (val === null || val === undefined) return '';
            return String(val).replace(/,/g, ''); // Limpiar comas para evitar saltos en CSV
        }).join(",")).join("\n");

    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "BASE_ACUMULADA_DILEMAS.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function clearAccumulatedDB() {
    let confirmacion = prompt("ATENCIÓN: Esto borrará la base de datos de esta computadora. Escribe 'BORRAR' para confirmar.");
    if(confirmacion === 'BORRAR') {
        localStorage.removeItem('bienes_publicos_db');
        alert("Base de datos local eliminada. La cuenta reiniciará.");
    } else {
        alert("Operación cancelada.");
    }
}

// Actualizar las exportaciones de window al final del archivo
window.iniciarDesdeBienvenida = iniciarDesdeBienvenida;
window.startExperimentSetup = startExperimentSetup;
window.startPractice = startPractice;
window.confirmTrial = confirmTrial;
window.nextPhase = nextPhase;
window.startBlock2 = startBlock2;
window.exportAccumulatedDB = exportAccumulatedDB;
window.clearAccumulatedDB = clearAccumulatedDB;

