-- =====================================================
-- SafeOne Intranet — Script de creación de tablas
-- Ejecutar en SQL Server Management Studio
-- =====================================================

-- 1. USUARIOS
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IntranetUsuarios')
CREATE TABLE IntranetUsuarios (
    Id VARCHAR(20) PRIMARY KEY,
    FullName VARCHAR(100) NOT NULL,
    Email VARCHAR(100),
    Department VARCHAR(50),
    Position VARCHAR(100),
    Birthday VARCHAR(5),          -- MM-DD
    PhotoUrl VARCHAR(500),
    AllowedDepartments NVARCHAR(MAX),  -- JSON array
    IsAdmin BIT DEFAULT 0,
    IsDepartmentLeader BIT DEFAULT 0,
    ReportsTo VARCHAR(20),
    Extension VARCHAR(10),
    Shift VARCHAR(20),
    Team VARCHAR(50),
    FleetPhone VARCHAR(20),
    WorkDaysPerWeek INT DEFAULT 5,
    HireDate DATETIME,
    PasswordHash VARCHAR(200),
    -- Offboarding
    EmployeeStatus VARCHAR(20) DEFAULT 'Activo',
    OffboardingDate DATETIME,
    OffboardingReason VARCHAR(50),
    OffboardingNotes NVARCHAR(500),
    OffboardingBy VARCHAR(20),
    -- Audit
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE()
);

-- 2. TICKETS
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IntranetTickets')
CREATE TABLE IntranetTickets (
    Id VARCHAR(20) PRIMARY KEY,
    Title VARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX),
    Category VARCHAR(50),
    Priority VARCHAR(20),
    Status VARCHAR(20) DEFAULT 'Abierto',
    CreatedBy VARCHAR(20),
    Department VARCHAR(50),
    SlaHours INT,
    SlaDeadline DATETIME,
    Attachments NVARCHAR(MAX),    -- JSON array
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (CreatedBy) REFERENCES IntranetUsuarios(Id)
);

-- 3. EQUIPOS
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IntranetEquipment')
CREATE TABLE IntranetEquipment (
    Id VARCHAR(20) PRIMARY KEY,
    Type VARCHAR(50),
    Brand VARCHAR(50),
    Model VARCHAR(50),
    SerialNumber VARCHAR(50),
    Status VARCHAR(20) DEFAULT 'Disponible',
    AssignedTo VARCHAR(20),
    Department VARCHAR(50),
    AssignedDate DATETIME,
    AcquisitionDate DATETIME,
    Notes NVARCHAR(500),
    Specifications NVARCHAR(MAX),  -- JSON
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (AssignedTo) REFERENCES IntranetUsuarios(Id)
);

-- 4. VEHÍCULOS
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IntranetVehicles')
CREATE TABLE IntranetVehicles (
    Id VARCHAR(20) PRIMARY KEY,
    Plate VARCHAR(20),
    Brand VARCHAR(50),
    Model VARCHAR(50),
    Year INT,
    Status VARCHAR(20) DEFAULT 'Activo',
    AssignedTo VARCHAR(20),
    AcquisitionDate DATETIME,
    Kilometers INT DEFAULT 0,
    Notes NVARCHAR(500),
    LastMaintenance DATETIME,
    NextMaintenance DATETIME,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (AssignedTo) REFERENCES IntranetUsuarios(Id)
);

-- 5. TELÉFONOS
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IntranetPhones')
CREATE TABLE IntranetPhones (
    Id VARCHAR(20) PRIMARY KEY,
    PhoneNumber VARCHAR(20),
    IMEI VARCHAR(20),
    Serial VARCHAR(50),
    Brand VARCHAR(50),
    Model VARCHAR(50),
    Status VARCHAR(20) DEFAULT 'Disponible',
    AssignedTo VARCHAR(20),
    Department VARCHAR(50),
    AssignedDate DATETIME,
    Notes NVARCHAR(500),
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (AssignedTo) REFERENCES IntranetUsuarios(Id)
);

-- 6. PERSONAL ARMADO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IntranetArmedPersonnel')
CREATE TABLE IntranetArmedPersonnel (
    Id VARCHAR(20) PRIMARY KEY,
    Name VARCHAR(100),
    Photo VARCHAR(500),
    AssignmentLocation VARCHAR(100),
    Position VARCHAR(100),
    Supervisor VARCHAR(100),
    FleetPhone VARCHAR(20),
    PersonalPhone VARCHAR(20),
    Address VARCHAR(200),
    WeaponType VARCHAR(50),
    WeaponSerial VARCHAR(50),
    WeaponBrand VARCHAR(50),
    WeaponCaliber VARCHAR(20),
    AmmunitionCount INT DEFAULT 0,
    LicenseNumber VARCHAR(50),
    LicenseExpiry DATETIME,
    AssignedDate DATETIME,
    Status VARCHAR(20) DEFAULT 'Activo',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE()
);

-- 7. NOTIFICACIONES
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IntranetNotifications')
CREATE TABLE IntranetNotifications (
    Id VARCHAR(20) PRIMARY KEY,
    Title VARCHAR(200),
    Message NVARCHAR(MAX),
    Type VARCHAR(50) DEFAULT 'info',
    UserId VARCHAR(20),
    IsRead BIT DEFAULT 0,
    ActionUrl VARCHAR(200),
    RelatedId VARCHAR(20),
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES IntranetUsuarios(Id)
);

-- 8. SOLICITUDES DE COMPRA
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IntranetPurchaseRequests')
CREATE TABLE IntranetPurchaseRequests (
    Id VARCHAR(20) PRIMARY KEY,
    Title VARCHAR(200),
    Items NVARCHAR(MAX),           -- JSON array
    TotalAmount DECIMAL(18,2),
    Justification NVARCHAR(MAX),
    Department VARCHAR(50),
    RequestedBy VARCHAR(20),
    Status VARCHAR(30) DEFAULT 'Pendiente',
    ApprovalLevel VARCHAR(50),
    ManagerApproval NVARCHAR(MAX), -- JSON
    GmApproval NVARCHAR(MAX),     -- JSON
    PurchaseStartedAt DATETIME,
    CompletedAt DATETIME,
    RejectionReason NVARCHAR(500),
    RejectedBy VARCHAR(20),
    RejectedAt DATETIME,
    QuotationFiles NVARCHAR(MAX), -- JSON array
    Notes NVARCHAR(MAX),
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (RequestedBy) REFERENCES IntranetUsuarios(Id)
);

-- 9. SOLICITUDES DE CONTRATACIÓN
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IntranetHiringRequests')
CREATE TABLE IntranetHiringRequests (
    Id VARCHAR(20) PRIMARY KEY,
    Position VARCHAR(100),
    Department VARCHAR(50),
    Justification NVARCHAR(MAX),
    SalaryRange VARCHAR(50),
    ContractType VARCHAR(20) DEFAULT 'Indefinido',
    Urgency VARCHAR(20) DEFAULT 'Normal',
    Requirements NVARCHAR(MAX),
    HasVehicle BIT DEFAULT 0,
    VehicleType VARCHAR(50),
    ResidentialZone VARCHAR(100),
    RequestedBy VARCHAR(20),
    Status VARCHAR(50) DEFAULT 'Pendiente Gerente Área',
    ManagerApproval NVARCHAR(MAX),
    GmApproval NVARCHAR(MAX),
    RejectionReason NVARCHAR(500),
    RejectedBy VARCHAR(20),
    RejectedAt DATETIME,
    RrhhStartedAt DATETIME,
    InterviewDate DATETIME,
    InterviewNotes NVARCHAR(MAX),
    CompletedAt DATETIME,
    Notes NVARCHAR(MAX),
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (RequestedBy) REFERENCES IntranetUsuarios(Id)
);

-- 10. GASTOS MENORES (CAJA CHICA)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IntranetMinorPurchases')
CREATE TABLE IntranetMinorPurchases (
    Id VARCHAR(20) PRIMARY KEY,
    Description NVARCHAR(500),
    Amount DECIMAL(18,2),
    PaymentMethod VARCHAR(30) DEFAULT 'Caja Chica',
    Category VARCHAR(50),
    Department VARCHAR(50),
    RequestedBy VARCHAR(20),
    RequestedByName VARCHAR(100),
    Status VARCHAR(20) DEFAULT 'Pendiente',
    ApprovedBy VARCHAR(20),
    ApprovedAt DATETIME,
    AssignedApprover VARCHAR(20),
    ReceiptUrl VARCHAR(500),
    Notes NVARCHAR(500),
    PurchasedBy VARCHAR(100),
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (RequestedBy) REFERENCES IntranetUsuarios(Id)
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX IX_Tickets_Status ON IntranetTickets(Status);
CREATE INDEX IX_Tickets_Department ON IntranetTickets(Department);
CREATE INDEX IX_Tickets_CreatedBy ON IntranetTickets(CreatedBy);
CREATE INDEX IX_Equipment_Status ON IntranetEquipment(Status);
CREATE INDEX IX_Vehicles_Status ON IntranetVehicles(Status);
CREATE INDEX IX_Phones_Status ON IntranetPhones(Status);
CREATE INDEX IX_Notifications_UserId ON IntranetNotifications(UserId);
CREATE INDEX IX_Notifications_IsRead ON IntranetNotifications(IsRead);
CREATE INDEX IX_PurchaseRequests_Status ON IntranetPurchaseRequests(Status);
CREATE INDEX IX_HiringRequests_Status ON IntranetHiringRequests(Status);
CREATE INDEX IX_MinorPurchases_Status ON IntranetMinorPurchases(Status);
CREATE INDEX IX_Users_Email ON IntranetUsuarios(Email);
CREATE INDEX IX_Users_Department ON IntranetUsuarios(Department);

PRINT '✅ Todas las tablas e índices creados exitosamente.';
