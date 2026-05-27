global.window = global;
global.allPayments = [];
global.allStudents = [];
global.reportMonth = new Date().getUTCMonth();
global.reportYear = new Date().getUTCFullYear();
global.getStudentStatus = () => 'active';
global.getStudentEnrollmentDate = () => new Date().toISOString();
