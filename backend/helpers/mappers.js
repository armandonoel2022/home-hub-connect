/**
 * Mappers: SQL Server rows → Frontend JSON shapes
 */

function safeJSON(str, fallback = []) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function mapUser(r) {
  return {
    id: r.Id,
    fullName: r.FullName,
    email: r.Email || '',
    department: r.Department || '',
    position: r.Position || '',
    birthday: r.Birthday || '',
    photoUrl: r.PhotoUrl || '',
    allowedDepartments: safeJSON(r.AllowedDepartments, []),
    isAdmin: !!r.IsAdmin,
    isDepartmentLeader: !!r.IsDepartmentLeader,
    reportsTo: r.ReportsTo || '',
    extension: r.Extension || '',
    shift: r.Shift || '',
    team: r.Team || '',
    fleetPhone: r.FleetPhone || '',
    workDaysPerWeek: r.WorkDaysPerWeek || 5,
    hireDate: r.HireDate || '',
    employeeStatus: r.EmployeeStatus || 'Activo',
    offboardingDate: r.OffboardingDate || '',
    offboardingReason: r.OffboardingReason || '',
    offboardingNotes: r.OffboardingNotes || '',
    offboardingBy: r.OffboardingBy || '',
  };
}

function mapTicket(r) {
  return {
    id: r.Id,
    title: r.Title,
    description: r.Description || '',
    category: r.Category,
    priority: r.Priority,
    status: r.Status,
    createdBy: r.CreatedBy,
    department: r.Department,
    createdAt: r.CreatedAt,
    updatedAt: r.UpdatedAt,
    slaHours: r.SlaHours,
    slaDeadline: r.SlaDeadline,
    attachments: safeJSON(r.Attachments, []),
  };
}

function mapEquipment(r) {
  return {
    id: r.Id,
    type: r.Type,
    brand: r.Brand,
    model: r.Model,
    serial: r.SerialNumber,
    status: r.Status,
    assignedTo: r.AssignedTo,
    department: r.Department,
    acquisitionDate: r.AssignedDate || r.AcquisitionDate || '',
    notes: r.Notes || '',
  };
}

function mapVehicle(r) {
  return {
    id: r.Id,
    plate: r.Plate,
    brand: r.Brand,
    model: r.Model,
    year: r.Year,
    status: r.Status,
    assignedTo: r.AssignedTo,
    acquisitionDate: r.AcquisitionDate || '',
    mileage: r.Kilometers || 0,
    notes: r.Notes || '',
  };
}

function mapPhone(r) {
  return {
    id: r.Id,
    imei: r.IMEI,
    serial: r.Serial || '',
    brand: r.Brand,
    model: r.Model,
    status: r.Status,
    assignedTo: r.AssignedTo,
    department: r.Department || '',
    acquisitionDate: r.AssignedDate || '',
    phoneNumber: r.PhoneNumber,
    notes: r.Notes || '',
  };
}

function mapPersonnel(r) {
  return {
    id: r.Id,
    name: r.Name || '',
    photo: r.Photo || '',
    location: r.AssignmentLocation || '',
    position: r.Position || '',
    supervisor: r.Supervisor || '',
    fleetPhone: r.FleetPhone || '',
    personalPhone: r.PersonalPhone || '',
    address: r.Address || '',
    weaponType: r.WeaponType || '',
    weaponSerial: r.WeaponSerial || '',
    weaponBrand: r.WeaponBrand || '',
    weaponCaliber: r.WeaponCaliber || '',
    ammunitionCount: r.AmmunitionCount || 0,
    licenseNumber: r.LicenseNumber || '',
    licenseExpiry: r.LicenseExpiry || '',
    assignedDate: r.AssignedDate || '',
    status: r.Status || 'Activo',
  };
}

function mapNotification(r) {
  return {
    id: r.Id,
    type: r.Type || 'info',
    title: r.Title,
    message: r.Message || '',
    relatedId: r.RelatedId || '',
    forUserId: r.UserId,
    read: !!r.IsRead,
    createdAt: r.CreatedAt,
    actionUrl: r.ActionUrl || '',
  };
}

function mapPurchaseRequest(r) {
  return {
    id: r.Id,
    title: r.Title || '',
    items: safeJSON(r.Items, []),
    totalAmount: r.TotalAmount || 0,
    justification: r.Justification || '',
    department: r.Department,
    requestedBy: r.RequestedBy,
    requestedAt: r.CreatedAt,
    status: r.Status,
    approvalLevel: r.ApprovalLevel || 'Jefe Directo',
    managerApproval: safeJSON(r.ManagerApproval, null),
    gmApproval: safeJSON(r.GmApproval, null),
    purchaseStartedAt: r.PurchaseStartedAt || null,
    completedAt: r.CompletedAt || null,
    rejectionReason: r.RejectionReason || null,
    rejectedBy: r.RejectedBy || null,
    rejectedAt: r.RejectedAt || null,
    quotationFiles: safeJSON(r.QuotationFiles, []),
    notes: r.Notes || '',
  };
}

function mapHiringRequest(r) {
  return {
    id: r.Id,
    positionTitle: r.Position,
    department: r.Department,
    justification: r.Justification || '',
    salaryRange: r.SalaryRange || '',
    contractType: r.ContractType || 'Indefinido',
    urgency: r.Urgency || 'Normal',
    requirements: r.Requirements || '',
    hasVehicle: !!r.HasVehicle,
    vehicleType: r.VehicleType || '',
    residentialZone: r.ResidentialZone || '',
    requestedBy: r.RequestedBy,
    requestedAt: r.CreatedAt,
    status: r.Status,
    managerApproval: safeJSON(r.ManagerApproval, null),
    gmApproval: safeJSON(r.GmApproval, null),
    rejectionReason: r.RejectionReason || null,
    rejectedBy: r.RejectedBy || null,
    rejectedAt: r.RejectedAt || null,
    rrhhStartedAt: r.RrhhStartedAt || null,
    interviewDate: r.InterviewDate || null,
    interviewNotes: r.InterviewNotes || '',
    completedAt: r.CompletedAt || null,
    notes: r.Notes || '',
  };
}

function mapMinorPurchase(r) {
  return {
    id: r.Id,
    description: r.Description || '',
    amount: r.Amount || 0,
    paymentMethod: r.PaymentMethod || 'Caja Chica',
    category: r.Category || '',
    department: r.Department,
    requestedBy: r.RequestedBy,
    requestedByName: r.RequestedByName || '',
    requestedAt: r.CreatedAt,
    status: r.Status,
    approvedBy: r.ApprovedBy || null,
    approvedAt: r.ApprovedAt || null,
    assignedApprover: r.AssignedApprover || null,
    receiptUrl: r.ReceiptUrl || '',
    notes: r.Notes || '',
    purchasedBy: r.PurchasedBy || '',
  };
}

module.exports = {
  safeJSON, mapUser, mapTicket, mapEquipment, mapVehicle,
  mapPhone, mapPersonnel, mapNotification, mapPurchaseRequest,
  mapHiringRequest, mapMinorPurchase,
};
