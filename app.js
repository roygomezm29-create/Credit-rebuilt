// Configuración de Supabase
const SUPABASE_URL = 'https://wxcymfijixeyyeyffawv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4Y3ltZmlqaXhleXlleWZmYXd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMDI3NzQsImV4cCI6MjA3MTg3ODc3NH0.59g2-h-0S56f5N_28cM4OeyM6bL2zXn1uYg3S7Z-jN4';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Estado global de la app
let appState = {
    tarjetas: [],
    ingresos: [],
    egresos: [],
    user_id: '8448ba0e-7e57-426c-95c4-40d12e5fa8c4'
};

// 1. CARGA INICIAL (LOCAL-FIRST INSTANTÁNEO)
document.addEventListener('DOMContentLoaded', async () => {
    // A) Carga inmediata desde el disco del iPhone
    const localData = localStorage.getItem('credit_app_state');
    if (localData) {
        try {
            appState = { ...appState, ...JSON.parse(localData) };
            renderUI();
        } catch (e) {
            console.error("Error al leer LocalStorage:", e);
        }
    }

    // B) Sincronización 100% silenciosa en segundo plano
    if (supabase) {
        await cargarDesdeSupabaseSilencioso();
    }
});

// Guardado síncrono local de respuesta inmediata
function guardarEstadoLocal() {
    localStorage.setItem('credit_app_state', JSON.stringify(appState));
    renderUI();
}

// Carga desde la nube sin alertas flotantes
async function cargarDesdeSupabaseSilencioso() {
    try {
        const [resTarjetas, resIngresos, resEgresos] = await Promise.all([
            supabase.from('tarjetas').select('*'),
            supabase.from('ingresos').select('*'),
            supabase.from('egresos').select('*')
        ]);

        let hubosCambios = false;

        if (!resTarjetas.error && resTarjetas.data && resTarjetas.data.length > 0) {
            appState.tarjetas = resTarjetas.data;
            hubosCambios = true;
        }
        if (!resIngresos.error && resIngresos.data && resIngresos.data.length > 0) {
            appState.ingresos = resIngresos.data;
            hubosCambios = true;
        }
        if (!resEgresos.error && resEgresos.data && resEgresos.data.length > 0) {
            appState.egresos = resEgresos.data;
            hubosCambios = true;
        }

        if (hubosCambios) {
            localStorage.setItem('credit_app_state', JSON.stringify(appState));
            renderUI();
        }
    } catch (err) {
        // Registro silencioso en consola (sin ventanas flotantes de error)
        console.warn("Sincronización en segundo plano pendiente:", err);
    }
}

// 2. REGISTRO DE DATOS Y PERSISTENCIA DUAL

async function agregarTarjeta(nombre, banco, limite, corte, pago) {
    const nuevaTarjeta = {
        id: 't_' + Date.now().toString(36),
        user_id: appState.user_id,
        nombre,
        banco,
        limite: parseFloat(limite) || 0,
        corte: parseInt(corte) || 1,
        pago: parseInt(pago) || 15
    };

    appState.tarjetas.push(nuevaTarjeta);
    guardarEstadoLocal();

    if (supabase) {
        try {
            await supabase.from('tarjetas').insert([nuevaTarjeta]);
        } catch (e) {
            console.warn("No se pudo subir la tarjeta a Supabase, guardada en local:", e);
        }
    }
}

async function agregarTransaccion(tipo, monto, concepto, tarjeta_id = null) {
    const item = {
        id: (tipo === 'ingreso' ? 'i_' : 'e_') + Date.now().toString(36),
        user_id: appState.user_id,
        monto: parseFloat(monto) || 0,
        concepto,
        fecha: new Date().toISOString().split('T')[0]
    };

    if (tipo === 'ingreso') {
        appState.ingresos.push(item);
        guardarEstadoLocal();
        if (supabase) {
            try { await supabase.from('ingresos').insert([item]); } catch (e) { console.warn(e); }
        }
    } else {
        item.tarjeta_id = tarjeta_id;
        appState.egresos.push(item);
        guardarEstadoLocal();
        if (supabase) {
            try { await supabase.from('egresos').insert([item]); } catch (e) { console.warn(e); }
        }
    }
}

// 3. ACTUALIZACIÓN VISUAL Y RESPALDO
function renderUI() {
    const totalIngresos = appState.ingresos.reduce((acc, i) => acc + (parseFloat(i.monto) || 0), 0);
    const totalEgresos = appState.egresos.reduce((acc, e) => acc + (parseFloat(e.monto) || 0), 0);
    const dineroDisponible = totalIngresos - totalEgresos;

    const elDisponible = document.getElementById('dinero-disponible');
    if (elDisponible) {
        elDisponible.textContent = `$${dineroDisponible.toLocaleString('es-MX')}`;
    }
}

// Guardado de emergencia al cerrar app en iOS
window.addEventListener('pagehide', () => {
    localStorage.setItem('credit_app_state', JSON.stringify(appState));
});
