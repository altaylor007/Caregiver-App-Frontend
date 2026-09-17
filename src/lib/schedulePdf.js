import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildDayCell(dayCell) {
    const stack = [
        { text: String(dayCell.dateLabel), bold: true, fontSize: 8, margin: [0, 0, 0, 2] },
    ];
    dayCell.shifts.forEach((shift) => {
        stack.push({
            stack: [
                { text: shift.title, bold: true, fontSize: 6.5 },
                { text: shift.timeLabel, fontSize: 6 },
                shift.assigneeLabel ? { text: shift.assigneeLabel, fontSize: 6, color: '#555555' } : null,
            ].filter(Boolean),
            margin: [0, 0, 0, 4],
        });
    });
    return {
        stack,
        fillColor: dayCell.isCurrentMonthDay ? null : '#f5f5f5',
        opacity: dayCell.isCurrentMonthDay ? 1 : 0.6,
    };
}

export function printSchedulePdf({ weeks, monthLabel }) {
    const headerRow = WEEKDAY_LABELS.map((label) => ({
        text: label,
        bold: true,
        alignment: 'center',
        fontSize: 9,
        fillColor: '#f0f0f0',
    }));
    const bodyRows = weeks.map((week) => week.map(buildDayCell));

    const docDefinition = {
        pageSize: 'LETTER',
        pageOrientation: 'landscape',
        pageMargins: [20, 40, 20, 20],
        header: () => ({
            text: `Agnes Care Team   ${monthLabel} Schedule`,
            fontSize: 14,
            bold: true,
            margin: [20, 15, 0, 0],
        }),
        content: [
            {
                table: {
                    headerRows: 1,
                    widths: Array(7).fill('*'),
                    body: [headerRow, ...bodyRows],
                },
                layout: {
                    hLineColor: () => '#cccccc',
                    vLineColor: () => '#cccccc',
                },
            },
        ],
        defaultStyle: { fontSize: 7 },
    };

    pdfMake.createPdf(docDefinition).print();
}
