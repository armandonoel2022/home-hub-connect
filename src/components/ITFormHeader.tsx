import logo from "../../backend/assets/safeone-form-logo.json";

const TITLES: Record<string, string> = {
  "F-IT-01": "SOLICITUD DE ALTA DE USUARIO",
  "F-IT-02": "SOLICITUD DE BAJA DE USUARIO",
  "F-IT-03": "SOLICITUD DE CAMBIOS DE PERMISOS",
  "F-IT-04": "REGISTRO DE EQUIPOS EN DOMINIO",
};

export default function ITFormHeader({ codigo }: { codigo: string }) {
  return (
    <div className="it-form-header">
      <div className="it-form-header-logo"><img src={logo.src} alt="SafeOne Security Company" /></div>
      <div className="it-form-header-title">
        <div>FORMULARIO: {codigo}</div>
        <div>{TITLES[codigo] || codigo}</div>
      </div>
    </div>
  );
}