// Configuración de Supabase (Utilizando tus credenciales actuales)
const SUPABASE_URL = 'https://wxcymfijixeyyeyffawv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4Y3ltZmlqaXhleXlleWZmYXd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMDI3NzQsImV4cCI6MjA3MTg3ODc3NH0.59g2-h-0S56f5N_28cM4OeyM6bL2zXn1uYg3S7Z-jN4';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Estado global en memoria
let appState = {
    tarjetas: [],
    ingresos: [],
    egresos: [],
    user_id: '8448ba0e-7e57-426c-95c4-40d12e5fa8c4' // ID de tu usuario actual
};

// 1. CARGA INICIAL (LOCAL-FIRST)
document.addEventListener('DOMContentLoaded', async () => {
    // A) Leer inmediatamente de LocalStorage para respuesta instantánea en iOS
    const localData = localStorage.getItem('credit_app_state');
    if (localData) {
        try {
            appState = { ...appState, ...JSON.parse(localData) };
            renderUI();
        } catch (e) {
            console.error("Error al leer LocalStorage:", e);
        }
    }

    // B) Sincronizar en segundo plano con Supabase sin bloquear la pantalla
    if (supabase) {
        await cargarDesdeSupabase();
    }
});

// Guardar en LocalStorage de forma síncrona e inmediata
function guardarEstadoLocal() {
    localStorage.setItem('credit_app_state', JSON.stringify(appState));
    renderUI();
}

// Cargar registros desde Supabase
async function cargarDesdeSupabase() {
    try {
        const [resTarjetas, resIngresos, resEgresos] = await Promise.all([
            supabase.from('tarjetas').select('*'),
            supabase.from('ingresos').select('*'),
            supabase.from('egresos').select('*')
        ]);

        if (!resTarjetas.error && resTarjetas.data) appState.tarjetas = resTarjetas.data;
        if (!resIngresos.error && resIngresos.data) appState.ingresos = resIngresos.data;
        if (!resEgresos.error && resEgresos.data) appState.egresos = resEgresos.data;

        // Respaldar la versión limpia obtenida de la nube
        guardarEstadoLocal();
    } catch (err) {
        console.warn("Modo Offline activo o falla de red:", err);
    }
}

// 2. FUNCIONES DE REGISTRO CON PERSISTENCIA DUAL

// Agregar Tarjeta
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

    // 1º Guardar en local al instante
    appState.tarjetas.push(nuevaTarjeta);
    guardarEstadoLocal();

    // 2º Enviar a Supabase
    if (supabase) {
        const { error } = await supabase.from('tarjetas').insert([nuevaTarjeta]);
        if (error) console.error("Error al sincronizar tarjeta:", error);
    }
}

// Agregar Transacción (Ingreso o Egreso)
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
        if (supabase) await supabase.from('ingresos').insert([item]);
    } else {
        item.tarjeta_id = tarjeta_id;
        appState.egresos.push(item);
        guardarEstadoLocal();
        if (supabase) await supabase.from('egresos').insert([item]);
    }
}

// 3. RENDERIZADO Y CÁLCULOS EN TIEMPO REAL
function renderUI() {
    // Cálculo de Dinero Total y Liquidez Real
    const totalIngresos = appState.ingresos.reduce((acc, i) => acc + (parseFloat(i.monto) || 0), 0);
    const totalEgresos = appState.egresos.reduce((acc, e) => acc + (parseFloat(e.monto) || 0), 0);
    const dineroDisponible = totalIngresos - totalEgresos;

    const elDisponible = document.getElementById('dinero-disponible');
    if (elDisponible) {
        elDisponible.textContent = `$${dineroDisponible.toLocaleString('es-MX')}`;
    }

    // Evento de respaldo al cerrar la ventana en iPhone (pagehide)
    window.addEventListener('pagehide', () => {
        localStorage.setItem('credit_app_state', JSON.stringify(appState));
    });
}
