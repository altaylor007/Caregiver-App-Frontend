import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { getCaregiverColor } from './scheduleColors';

pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TULIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <!-- center petal -->
  <path fill="#0d9488" d="M 50 10 C 60 40, 60 60, 50 75 C 40 60, 40 40, 50 10 Z" />
  <!-- left petal -->
  <path fill="#0d9488" d="M 30 20 C 40 30, 45 50, 50 75 C 35 70, 20 50, 30 20 Z" />
  <!-- right petal -->
  <path fill="#0d9488" d="M 70 20 C 60 30, 55 50, 50 75 C 65 70, 80 50, 70 20 Z" />
  <!-- stem -->
  <rect fill="#0d9488" x="47" y="75" width="6" height="25" rx="3" />
  <!-- leaf -->
  <path fill="#0d9488" d="M 50 85 C 65 85, 75 75, 75 55 C 75 80, 60 95, 50 90 Z" />
</svg>`;

function buildDayCell(dayCell, caregiverColorMap) {
    if (!dayCell.shifts || dayCell.shifts.length === 0) {
        return {
            stack: [
                { text: String(dayCell.dateLabel), bold: true, fontSize: 12, alignment: 'right', margin: [0, 0, 0, 2] },
            ],
            fillColor: dayCell.isCurrentMonthDay ? null : '#f5f5f5',
            opacity: dayCell.isCurrentMonthDay ? 1 : 0.6,
        };
    }

    const stack = [];
    dayCell.shifts.forEach((shift, index) => {
        const isAssigned = shift.caregiverId && shift.assigneeLabel && shift.assigneeLabel !== 'Open Shift';
        const color = isAssigned && caregiverColorMap ? getCaregiverColor(shift.caregiverId, caregiverColorMap) : null;
        const isFirst = index === 0;

        const dateChip = {
            table: {
                widths: ['auto'],
                body: [
                    [
                        {
                            text: String(dayCell.dateLabel),
                            bold: true,
                            fontSize: 10,
                            alignment: 'center',
                            color: '#000000',
                            fillColor: '#ffffff',
                            border: [false, false, false, false],
                        },
                    ],
                ],
            },
            layout: {
                paddingLeft: () => 2.5,
                paddingRight: () => 2.5,
                paddingTop: () => 0,
                paddingBottom: () => 0,
            },
            width: 'auto',
        };

        const headerNode = isFirst ? {
            columns: [
                { text: shift.title, bold: true, fontSize: 7, color: '#000000', width: '*' },
                dateChip,
            ],
        } : {
            text: shift.title,
            bold: true,
            fontSize: 7,
            color: color ? '#000000' : undefined,
        };

        if (color) {
            stack.push({
                table: {
                    widths: ['*'],
                    body: [
                        [
                            {
                                stack: [
                                    headerNode,
                                    { text: shift.timeLabel, fontSize: 7, color: '#111111' },
                                    shift.assigneeLabel ? { text: shift.assigneeLabel, fontSize: 9, bold: true, color: '#000000' } : null,
                                ].filter(Boolean),
                                fillColor: color,
                                border: [false, false, false, false],
                            },
                        ],
                    ],
                },
                layout: {
                    paddingLeft: () => 2,
                    paddingRight: () => 2,
                    paddingTop: () => 1,
                    paddingBottom: () => 1,
                },
                margin: [0, 0, 0, 1.5],
            });
        } else {
            stack.push({
                stack: [
                    headerNode,
                    { text: shift.timeLabel, fontSize: 7 },
                    shift.assigneeLabel ? { text: shift.assigneeLabel, fontSize: 9, color: '#555555' } : null,
                ].filter(Boolean),
                margin: [0, 0, 0, caregiverColorMap ? 1.5 : 3],
            });
        }
    });
    return {
        stack,
        fillColor: dayCell.isCurrentMonthDay ? null : '#f5f5f5',
        opacity: dayCell.isCurrentMonthDay ? 1 : 0.6,
    };
}

export function printSchedulePdf({ weeks, monthLabel, caregiverColorMap, activeCaregivers }) {
    const headerRow = WEEKDAY_LABELS.map((label) => ({
        text: label,
        bold: true,
        alignment: 'center',
        fontSize: 9,
        fillColor: '#f0f0f0',
    }));
    const bodyRows = weeks.map((week) => week.map((day) => buildDayCell(day, caregiverColorMap)));

    const content = [];

    if (caregiverColorMap) {
        const caregiversList = [];
        const seen = new Set();
        const roster = activeCaregivers || caregiverColorMap._activeCaregivers;
        if (roster && roster.length) {
            roster.forEach((cg) => {
                if (cg.id && !seen.has(cg.id)) {
                    seen.add(cg.id);
                    caregiversList.push({
                        id: cg.id,
                        name: cg.first_name || cg.full_name || 'Caregiver',
                        color: getCaregiverColor(cg.id, caregiverColorMap),
                    });
                }
            });
        } else {
            weeks.forEach((week) => {
                week.forEach((day) => {
                    day.shifts.forEach((shift) => {
                        if (shift.caregiverId && shift.assigneeLabel && shift.assigneeLabel !== 'Open Shift' && !seen.has(shift.caregiverId)) {
                            seen.add(shift.caregiverId);
                            caregiversList.push({
                                id: shift.caregiverId,
                                name: shift.assigneeLabel,
                                color: getCaregiverColor(shift.caregiverId, caregiverColorMap),
                            });
                        }
                    });
                });
            });
            caregiversList.sort((a, b) => a.name.localeCompare(b.name));
        }

        if (caregiversList.length > 0) {
            const legendItems = caregiversList.map((cg) => ({
                columns: [
                    {
                        width: 7,
                        canvas: [
                            {
                                type: 'rect',
                                x: 0,
                                y: 1,
                                w: 7,
                                h: 7,
                                color: cg.color,
                                lineColor: '#666666',
                                lineWidth: 0.5,
                            },
                        ],
                    },
                    {
                        width: 'auto',
                        text: cg.name,
                        fontSize: 6.5,
                        bold: true,
                        color: '#111111',
                        margin: [2, 0, 0, 0],
                    },
                ],
                border: [false, false, false, false],
                margin: [0, 0, 6, 0],
            }));

            const CHUNK_SIZE = 10;
            const legendRows = [];
            for (let i = 0; i < legendItems.length; i += CHUNK_SIZE) {
                legendRows.push(legendItems.slice(i, i + CHUNK_SIZE));
            }
            const maxCols = Math.min(legendItems.length, CHUNK_SIZE);
            legendRows.forEach((row) => {
                while (row.length < maxCols) {
                    row.push({ text: '', border: [false, false, false, false] });
                }
            });

            content.push({
                table: {
                    widths: Array(maxCols).fill('auto'),
                    body: legendRows,
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 2.5],
            });
        }
    }

    content.push({
        table: {
            headerRows: 1,
            widths: Array(7).fill('*'),
            body: [headerRow, ...bodyRows],
        },
        layout: {
            hLineColor: () => '#cccccc',
            vLineColor: () => '#cccccc',
        },
    });

    const docDefinition = {
        pageSize: 'LETTER',
        pageOrientation: 'landscape',
        pageMargins: caregiverColorMap ? [20, 26, 20, 8] : [20, 40, 20, 20],
        header: () => {
            if (!caregiverColorMap) {
                return {
                    text: `Agnes Care Team   ${monthLabel} Schedule`,
                    fontSize: 14,
                    bold: true,
                    margin: [20, 15, 0, 0],
                };
            }
            return {
                columns: [
                    {
                        svg: TULIP_SVG,
                        width: 20,
                        height: 20,
                    },
                    {
                        text: `Agnes Care Team   ${monthLabel} Schedule`,
                        fontSize: 13,
                        bold: true,
                        margin: [6, 3, 0, 0],
                    },
                ],
                margin: [20, 4, 0, 0],
            };
        },
        content,
        defaultStyle: { fontSize: 7 },
    };

    pdfMake.createPdf(docDefinition).print();
}
