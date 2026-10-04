const sumIncludedExpenses = (r) =>
    (r.expenses || []).filter(x => !x.declined).reduce((s, x) => s + Number(x.amount), 0);

export const buildPayrollEnabledSms = (rows, weDate) => {
    if (!rows || rows.length === 0) return '';
    const lines = rows.map(r => {
        const firstName = r.full_name.split(' ')[0];
        const reimb = sumIncludedExpenses(r);
        const expLine = reimb > 0 ? `\n+ $${reimb.toFixed(2)} expenses` : '';
        if (r.holiday_hours === 0) {
            return `${firstName}\n${r.total_hours} Hours${expLine}`;
        }
        return `${firstName}\n${r.holiday_hours} holiday hrs | ${r.regular_hours} regular hrs | ${r.total_hours} total hrs${expLine}`;
    }).join('\n\n');
    return `WE ${weDate}\n\n${lines}`;
};

export const calculatePay = (r) =>
    Math.round(((r.regular_hours * 30) + (r.holiday_hours * 45)) * 100) / 100;

export const buildIndependentSms = (rows, weDate) => {
    if (!rows || rows.length === 0) return '';
    const fmt = n => Number.isInteger(n) ? `${n}` : n.toFixed(2);
    const lines = rows.map(r => {
        const firstName = r.full_name.split(' ')[0];
        const pay = calculatePay(r);
        const reimb = Math.round(sumIncludedExpenses(r) * 100) / 100;
        const hoursLine = r.holiday_hours > 0
            ? `${r.holiday_hours} holiday hrs | ${r.regular_hours} regular hrs | ${r.total_hours} total hrs`
            : `${r.total_hours} hours`;
        if (reimb > 0) {
            const total = Math.round((pay + reimb) * 100) / 100;
            return `${firstName}\nTotal due: $${fmt(total)}\n\n${hoursLine}\n$${fmt(pay)}\n\n$${fmt(reimb)} expenses`;
        }
        return `${firstName}\n\n${hoursLine}\n$${fmt(pay)}`;
    }).join('\n\n');
    return `WE ${weDate}\n\n${lines}`;
};
