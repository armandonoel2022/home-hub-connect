// OSM Client Monitoring Data Types & Storage

export type ClientMonitoringStatus = "Activo" | "Inactivo" | "Investigar" | "Visita Tecnica" | "Sin monitoreo" | "Linea Telefonica" | "Safe y Kronos" | "Suspendido";
export type ClientResolutionStatus = "Pendiente" | "Resuelto";
export type SystemStatus = "Encendido" | "Apagado" | "Suspendido" | "Inactivo";
export type BillingConfirmation = "Activa" | "Inactiva" | "Inaviva" | "No existe";

export interface OSMClient {
  id: string;
  accountCode: string;
  businessName: string;
  contact: string;
  phone: string;
  monitoringStatus: ClientMonitoringStatus;
  resolutionStatus: ClientResolutionStatus;
  notes: string;
  // From system inventory (Page 2)
  systemName?: string;
  systemStatus?: SystemStatus;
  // From billing (Page 6)
  billingClient?: string;
  billingDescription?: string;
  billingEmail?: string;
  billingArticle?: string;
  hasBilling: boolean;
  // Metadata
  lastUpdated: string;
  updatedBy?: string;
}

const STORAGE_KEY = "osm_clients_data";
const SEED_VERSION_KEY = "osm_clients_seed_v";
const CURRENT_SEED = 3;

function generateId(): string {
  return "OSM-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Seed data from Excel
function getInitialData(): OSMClient[] {
  return [
    { id: generateId(), accountCode: "8003", businessName: "FARMAMED", contact: "", phone: "809-977-1644", monitoringStatus: "Visita Tecnica", resolutionStatus: "Pendiente", notes: "La chica necesita una visita tecnica para revisar un sensor", hasBilling: true, billingClient: "LABORATORIOS FARMAMED DOMINICANA, SRL", billingEmail: "laboratoriosfd@hotmail.com", billingDescription: "Servicio de Monitoreo Básico", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "2484", businessName: "GRUPO JARDINES ILUCIONES", contact: "GISELLE MATOS", phone: "809-284-4636", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "Se realizo visita tecnica | caso resuelto", hasBilling: true, billingClient: "JARDIN ILUSIONES, SRL", billingEmail: "contabilidad@grupoilusiones.com", billingDescription: "Servicio Monitoreo y Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "5488", businessName: "RESIDENCIA CAROLINA HENRIQUEZ", contact: "CAROLINA HENRIQUEZ", phone: "809-880-5964", monitoringStatus: "Investigar", resolutionStatus: "Pendiente", notes: "Seguimiento en kronos, no llegan notificaciones.", hasBilling: true, billingClient: "RES. CAROLINA HENRIQUEZ", billingEmail: "chenriquezr@hotmail.com", billingDescription: "Servicio Monitoreo de Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "2007", businessName: "FLAWLESS MAKEUP", contact: "ROLAND", phone: "809-968-5675", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "Resuelto. Llevan desde el 29 sin realizar un cierre, verificar con el cliente.", hasBilling: true, billingClient: "FLAWLESS MAKEUP BY LILY MUA EIRL", billingEmail: "flawlessmakeup@gmail.com", billingDescription: "Servicio monitoreo de alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "9107", businessName: "JEROME AUTOSERVICES SRL", contact: "NATANAEL JEROME", phone: "809-214-9102", monitoringStatus: "Investigar", resolutionStatus: "Pendiente", notes: "Desde el 2024 sin realizar ninguna actividad en la cuenta, verificar con el cliente.", hasBilling: true, billingClient: "JEROME AUTOSERVICES SRL", billingEmail: "infojeromerd@gmail.com", billingDescription: "Servicio monitoreo de alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "", businessName: "RES. ANA ROSA NUÑEZ", contact: "", phone: "", monitoringStatus: "Sin monitoreo", resolutionStatus: "Pendiente", notes: "No existe en ninguno de los programas de monitoreo, verificar con servicio al cliente si esta activa con el monitoreo.", hasBilling: true, billingClient: "RES. ANA ROSA NUÑEZ", billingEmail: "", billingDescription: "Servicio monitoreo de alarma", systemStatus: undefined, lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8998", businessName: "R & V AUTO TUNING", contact: "VILMA VARGAS", phone: "829-384-6792", monitoringStatus: "Investigar", resolutionStatus: "Pendiente", notes: "Desde el 2025-8-22 sin realizar un cierre verificar.", hasBilling: true, billingClient: "ROWIL & NICOLE AUTO TUNING SRL", billingEmail: "autotuningrv@gmail.com", billingDescription: "Servicio Monitoreo Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "9124", businessName: "CENTRO FERRETERO GRUPO CMA REYES", contact: "CARLOS MARQUES", phone: "829-771-9756", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "Se realizo una visita tecnica el dia 23/03/26 caso resuelto", hasBilling: true, billingClient: "CENTRO FERRETERO C.M.A.", billingEmail: "CARLOSMARQUEZ111973@HOTMAIL.COM", billingDescription: "Servicio Monitoreo y Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "5398", businessName: "QUICKIE (SR & RN IMPORT SRL)", contact: "STEVE REYNOSO", phone: "809-603-6000", monitoringStatus: "Inactivo", resolutionStatus: "Pendiente", notes: "Problemas con la comunicacion, tenemos tiempo sin recibir ninguna alerta.", hasBilling: true, billingClient: "SR & RN IMPORT SRL", billingEmail: "gllamasb@hotmail.com", billingDescription: "Servicio Monitoreo y Alarma Naco", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8907", businessName: "EDIFICIO LFT (RES. MARISOL CONTRERAS)", contact: "MARI CONTRERAS", phone: "240-370-2519", monitoringStatus: "Investigar", resolutionStatus: "Pendiente", notes: "Desde 29 de enero sin recibir alertas, contactar con el cliente para preguntar.", hasBilling: true, billingClient: "RES. MARISOL CONTRERAS", billingEmail: "", billingDescription: "Monitoreo Alarma y Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "", businessName: "RES. CESAR ALEXANDER CRUZ", contact: "", phone: "", monitoringStatus: "Sin monitoreo", resolutionStatus: "Pendiente", notes: "No aparece en ninguna de las aplicaciones de monitoreo.", hasBilling: true, billingClient: "RES. CESAR ALEXANDER CRUZ", billingEmail: "", billingDescription: "Servicio Monitoreo y Alarma", systemStatus: undefined, lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8918", businessName: "RAPID PACK", contact: "", phone: "809-973-7143", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "Se realizo una visita tecnica | caso resuelto", hasBilling: true, billingClient: "AM SK CARG LOGIST LA MENSAJERIA SRL (RAPID PACK)", billingEmail: "alexanderduarte3@gmail.com", billingDescription: "Servicio Monitoreo Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8997", businessName: "GRUPO VE+58", contact: "RAFAEL PEREZ", phone: "849-212-1919", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: false, systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "5481", businessName: "JEAN LICORES", contact: "JUAN CARLOS SERRATA", phone: "829-357-6735", monitoringStatus: "Investigar", resolutionStatus: "Pendiente", notes: "El sistema no nos llegan las alertas correctamente", hasBilling: true, billingClient: "JEAN LICORES JCS SRL", billingEmail: "juancarlos2684@hotmail.com", billingDescription: "SERVICIO DE MONITOREO ALARMAS", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "", businessName: "RES. GREGORY GARCIA", contact: "", phone: "", monitoringStatus: "Sin monitoreo", resolutionStatus: "Pendiente", notes: "No aparece en ninguna de las aplicaciones de monitoreos.", hasBilling: false, systemStatus: undefined, lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "5393", businessName: "RESIDENCIA DE CLEIDY", contact: "CLEIDY JULIANA", phone: "809-780-5302", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "Se realizo visita tecnica | Caso resuelto. Reporto tener problemas con la bateria y solicita una visita tecnica.", hasBilling: true, billingClient: "CLEIDY JULIANA LORENZO LORA", billingEmail: "LORENZOCLEIDY@GMAIL.COM", billingDescription: "Servicio Monitoreo Alarmas", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "", businessName: "RAINERI JONAS MARTIN FRIAS", contact: "", phone: "", monitoringStatus: "Sin monitoreo", resolutionStatus: "Pendiente", notes: "Necesitamos mas informacion para identificarla en el sistema.", hasBilling: true, billingClient: "RAINERI JONAS MARTIN FRIAS", billingEmail: "Rainerimartin49@gmail.com", billingDescription: "PLAN SISTEMA MONITOREO ALARMA", systemStatus: undefined, lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "", businessName: "JAN, S.R.L", contact: "XIOMARA MORET", phone: "849-353-1431", monitoringStatus: "Visita Tecnica", resolutionStatus: "Pendiente", notes: "Problemas con la comunicacion, no nos aparece en el sistema las alertas de aperturas y cierres.", hasBilling: true, billingClient: "JAN, S.R.L.", billingEmail: "contabilidad@almalum.com", billingDescription: "PLAN SISTEMA DE ALARMA- SAN PEDRO", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "4012", businessName: "TOPCAR BY LCP GROUP SRL", contact: "OSCAR PANIAGUA", phone: "829-828-1493", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "Se realizo visita tecnica | caso resuelto. Se le olvida algunas veces cerrar.", hasBilling: true, billingClient: "TOPCAR BY LCP GROUP SRL", billingEmail: "TOPCAR.RD18@GMAIL.COM", billingDescription: "Monitoreo de Alarmas", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "4013", businessName: "SOBREMESA EMPRESARIAL Y CATERING, SRL", contact: "ERICK FLORES", phone: "809-980-0949", monitoringStatus: "Investigar", resolutionStatus: "Pendiente", notes: "Lleva 1 mes sin realizar el cierre (Confirmar con el cliente si tiene algun problema).", hasBilling: true, billingClient: "SOBREMESA EMPRESARIAL Y CATERING, SRL", billingEmail: "hola@sobremesard.com", billingDescription: "Plan Monitoreo de Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8001", businessName: "PATRIA ALBA YRIS", contact: "ALBA YRIS SANTOS", phone: "809-383-9888", monitoringStatus: "Investigar", resolutionStatus: "Pendiente", notes: "Lleva mas de 15 dias sin realizar un cierre.", hasBilling: true, billingClient: "PATRIA ALBA YRIS", billingEmail: "albayrissantos@gmail.com", billingDescription: "Plan Monitoreo de Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8989", businessName: "YUYAX SRL", contact: "Xavier Alcantara", phone: "809-357-6613", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "Se realizo visita tecnica caso resuelto.", hasBilling: true, billingClient: "YUYAX SRL", billingEmail: "Xavieralcantarac@gmail.com", billingDescription: "Sistema Monitoreo Alarma y Cámara", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "5895", businessName: "FERRETERIA ARENERA C&M EIRL", contact: "ALBA CASTRO", phone: "849-353-4552", monitoringStatus: "Inactivo", resolutionStatus: "Pendiente", notes: "Suspendido temporalmente, pero sigue activa, todavia no cancela el servicio.", hasBilling: false, systemStatus: "Suspendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "2010", businessName: "COCHE RD", contact: "Cesar Tronillo", phone: "(849) 220-9390", monitoringStatus: "Inactivo", resolutionStatus: "Pendiente", notes: "El monitoreo de la sucursal es via telefonica y estamos teniendo problemas con las alarmas.", hasBilling: false, systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "1000", businessName: "CASECOR", contact: "Caraballo", phone: "(829) 521-1490", monitoringStatus: "Linea Telefonica", resolutionStatus: "Pendiente", notes: "No estamos recibiendo alertas.", hasBilling: false, systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "2496", businessName: "Toro Business Catalys SRL AV Romulo Betancourt", contact: "", phone: "809-330-6969", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "Se realizo una visita tecnica 01-04-26. Resuelto.", hasBilling: true, billingClient: "TORO BUSINESS CATALYST SRL", billingEmail: "afamilia@toro.com.do", billingDescription: "Servicio Monitoreo y Alarma BELLA VISTA", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "4010", businessName: "MAPACA", contact: "", phone: "849-285-1287", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "Resuelto. Lleva 7 dias sin cerrar.", hasBilling: true, billingClient: "MAPACA DIGITAL GROUP EIRL", billingEmail: "mcdigitalrd@gmail.com", billingDescription: "Monitoreo 24/7 Asistencia de Seguridad Respuesta Reactiva", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "5501", businessName: "RESIDENCIA FERNANDO CRESPO (CIMADEVILLA)", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "CIMADEVILLA SRL", billingEmail: "sjoa@galeria360.com.do", billingDescription: "Servicio Monitoreo Alarma", systemStatus: "Apagado", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8640", businessName: "REPLAY RENT STORE", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "REALY RENT STORE", billingEmail: "nicole.1415@hotmail.com", billingDescription: "Servicio Monitoreo y Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8895", businessName: "BENNY STORE", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "BENNY STORE", billingEmail: "bennystorerd@gmail.com", billingDescription: "Servicio Monitoreo y Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    // Jade Teriyaki Group
    { id: generateId(), accountCode: "0078", businessName: "JADE TERIYAKI - PLAZA BAVARO CITY CENTER", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "JADE TERIYAKI S A", billingEmail: "contabilidad@expresojade.com", billingDescription: "Servicios de Monitoreo de Alarma - Bavaro City", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8095", businessName: "JADE TERIYAKI - PLAZA DUARTE", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "JADE TERIYAKI S A", billingEmail: "contabilidad@expresojade.com", billingDescription: "Servicio Monitoreo de Alarma- Plaza Duarte", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "5885", businessName: "JADE TERIYAKI COLINAS MALL", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "JADE TERIYAKI S A", billingEmail: "contabilidad@expresojade.com", billingDescription: "Servicios de Monitoreo de Alarma - Santiago Colinas Mall", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    // Betcris Group
    { id: generateId(), accountCode: "8614", businessName: "BETCRIS - MALECON", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "BETCRIS BANCA DE APUESTA SRL", billingEmail: "Cuentasporpagardr@betcris.com", billingDescription: "Servicio Monitoreo y Alarma- Av.George Washington", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "9104", businessName: "BETCRIS - BAVARO", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "BETCRIS BANCA DE APUESTA SRL", billingEmail: "Cuentasporpagardr@betcris.com", billingDescription: "Servicio Monitoreo y Alarma-Suc. Bavaro", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8644", businessName: "BETCRIS - SABANA LARGA", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "BETCRIS BANCA DE APUESTA SRL", billingEmail: "Cuentasporpagardr@betcris.com", billingDescription: "Servicio Monitoreo y Alarma-Sabana Larga", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8899", businessName: "BETCRIS - SANTIAGO", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "BETCRIS BANCA DE APUESTA SRL", billingEmail: "Cuentasporpagardr@betcris.com", billingDescription: "Servicio Monitoreo y Alarma Suc. Santiago", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    // More clients
    { id: generateId(), accountCode: "5882", businessName: "JOSE ARMENTEROS Y Co. (Almacen)", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "JOSE ARMENTEROS & Co.", billingEmail: "bsosa@jaco.com.do", billingDescription: "Servicio de monitoreo de alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "1001", businessName: "CAMARA DE COMERCIO Y PRODUCCION", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "CAMARA DE COMERCIO Y PRODUCCION DE SANTO DOMINGO", billingEmail: "ihernandez@camarasantodomingo.do", billingDescription: "Servicio de Monitoreo de alarma y respuesta armada 24/7", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8004", businessName: "LITTLE CAESARS", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "LCPZ DOMINICAN REPUBLIC SRL", billingEmail: "dcruz@pcsapi.com", billingDescription: "Plan Monitoreo de Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "5854", businessName: "URBAN GROUP", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "URBANGROUP SOLUTIONS", billingEmail: "administracion@urbangrouprd.com", billingDescription: "Servicio Monitoreo y Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8994", businessName: "WILLI DENTAL", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "WILLY DENTAL SRL", billingEmail: "willydentalrd@gmail.com", billingDescription: "Servicio Monitoreo Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8993", businessName: "BENUA IMPORTACION SRL", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "BENUA IMPORT SRL", billingEmail: "benua55@hotmail.com", billingDescription: "Servicio de Monitoreo Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "5478", businessName: "OMD", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "INMOBILIARIA COLE SRL (OMD)", billingEmail: "lisselot.guerrero@ex4cto.com", billingDescription: "Servicio Monitoreo y Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "5413", businessName: "PAGINAS BBDO", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "PAGES BBDO SRL", billingEmail: "cindy.lopez@ex4cto.com", billingDescription: "Servicio Monitoreo y Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8916", businessName: "JDPTECH", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "JDP TECH", billingEmail: "ing.perezcuevas@hotmail.com", billingDescription: "Servicio Monitoreo Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8915", businessName: "GRUPO CERRO ALTO", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "GRUPO CERRO ALTO SRL", billingEmail: "grupocerroalto@gmail.com", billingDescription: "Servicio Monitoreo Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8940", businessName: "IMBELCON SRL", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: false, systemStatus: "Encendido", lastUpdated: "2026-04-01" },
    { id: generateId(), accountCode: "8979", businessName: "JDF AUTO PARTS", contact: "", phone: "", monitoringStatus: "Activo", resolutionStatus: "Resuelto", notes: "", hasBilling: true, billingClient: "JDF AUTO PARTS", billingEmail: "jdfautoparts@claro.net.do", billingDescription: "Servicio Monitoreo Alarma", systemStatus: "Encendido", lastUpdated: "2026-04-01" },
  ];
}

export function getOSMClients(): OSMClient[] {
  const seedVersion = localStorage.getItem(SEED_VERSION_KEY);
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored || seedVersion !== String(CURRENT_SEED)) {
    const initial = getInitialData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    localStorage.setItem(SEED_VERSION_KEY, String(CURRENT_SEED));
    return initial;
  }

  return JSON.parse(stored);
}

export function saveOSMClients(clients: OSMClient[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

export function addOSMClient(client: Omit<OSMClient, "id">): OSMClient {
  const clients = getOSMClients();
  const newClient: OSMClient = { ...client, id: generateId() };
  clients.push(newClient);
  saveOSMClients(clients);
  return newClient;
}

export function updateOSMClient(id: string, updates: Partial<OSMClient>): void {
  const clients = getOSMClients();
  const idx = clients.findIndex((c) => c.id === id);
  if (idx >= 0) {
    clients[idx] = { ...clients[idx], ...updates, lastUpdated: new Date().toISOString().slice(0, 10) };
    saveOSMClients(clients);
  }
}

export function deleteOSMClient(id: string): void {
  const clients = getOSMClients().filter((c) => c.id !== id);
  saveOSMClients(clients);
}
