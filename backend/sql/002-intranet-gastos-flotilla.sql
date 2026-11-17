/*
  Tabla propia para los gastos de Flotilla — Mantenimiento registrados en la intranet.
  Base: SafeOne. NO modifica tablas contables (GastoMenor, Compra, Suplidor...).
  La intranet la crea con el botón "Preparar base de datos" (solo Chrisnel Fabián);
  también puede ejecutarse a mano en SQL Server Management Studio.
  La intranet nunca borra filas: solo INSERT y UPDATE (anulación lógica).
*/
IF OBJECT_ID('dbo.IntranetGastosFlotilla', 'U') IS NULL
CREATE TABLE dbo.IntranetGastosFlotilla (
  OID               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IntranetGastosFlotilla PRIMARY KEY,
  IntranetId        NVARCHAR(30)   NOT NULL CONSTRAINT UQ_IntranetGastosFlotilla_IntranetId UNIQUE,
  Placa             NVARCHAR(20)   NOT NULL,
  Unidad            NVARCHAR(300)  NULL,
  TipoUnidad        NVARCHAR(20)   NULL,
  Asignacion        NVARCHAR(200)  NULL,
  Fecha             DATE           NOT NULL,
  TipoMantenimiento NVARCHAR(60)   NULL,
  Taller            NVARCHAR(200)  NULL,
  SuplidorOID       INT            NULL,
  Kilometraje       INT            NULL,
  Costo             DECIMAL(18,2)  NOT NULL CONSTRAINT CK_IntranetGastosFlotilla_Costo CHECK (Costo > 0),
  Detalle           NVARCHAR(1000) NULL,
  Anulado           BIT            NOT NULL CONSTRAINT DF_IntranetGastosFlotilla_Anulado DEFAULT 0,
  MotivoAnulacion   NVARCHAR(500)  NULL,
  RegistradoPor     NVARCHAR(150)  NOT NULL,
  RegistradoEn      DATETIME2      NOT NULL CONSTRAINT DF_IntranetGastosFlotilla_RegistradoEn DEFAULT SYSDATETIME(),
  ActualizadoPor    NVARCHAR(150)  NULL,
  ActualizadoEn     DATETIME2      NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_IntranetGastosFlotilla_Placa_Fecha')
CREATE INDEX IX_IntranetGastosFlotilla_Placa_Fecha ON dbo.IntranetGastosFlotilla (Placa, Fecha);
GO
