// Perceptually distinct pastel palette with consistent saturation (75%) and lightness (83%)
// Computed from evenly spaced HSL hues (>= 30° apart around the color wheel)
export const CAREGIVER_PALETTE = [
    '#f4b9b3', // Coral Red        (H=  5°, S=75%, L=83%)
    '#f4dcb3', // Warm Orange      (H= 38°, S=75%, L=83%)
    '#ebf4b3', // Sunny Yellow     (H= 68°, S=75%, L=83%)
    '#c7f4b3', // Lime Green       (H=102°, S=75%, L=83%)
    '#b3f4c9', // Mint Green       (H=140°, S=75%, L=83%)
    '#b3f4ef', // Teal / Aqua      (H=175°, S=75%, L=83%)
    '#b3d4f4', // Sky Blue         (H=210°, S=75%, L=83%)
    '#b9b3f4', // Indigo Blue      (H=245°, S=75%, L=83%)
    '#e1b3f4', // Purple / Violet  (H=282°, S=75%, L=83%)
    '#f4b3d1', // Magenta / Pink   (H=332°, S=75%, L=83%)
];

export const MANUAL_COLOR_OVERRIDES = {
    '29cccb88-188e-49fc-8b67-88484ca660e2': '#ebf4b3', // Sunny: Sunny Yellow
    'c6684767-3f3b-40f4-aece-dd5288a5eb11': '#e1b3f4', // Rachel: Purple / Violet
    'f14a48c3-f584-4454-9c03-404d0b74c53a': '#b3d4f4', // Amy Jo: Sky Blue
    'ffc9b7f1-102b-4cc5-b2e1-4a2be53880a3': '#f4b3d1', // Johnnie Mae: Magenta / Pink
    'b8760730-de30-49a7-89d9-5698d8e6da37': '#f4b9b3', // Shelly: Coral Red
    '15743de2-9e2b-4bf0-a5bc-be3fc25da684': '#b3f4ef', // Barbara: Teal / Aqua
    '81b37b01-0950-4882-b0b2-d0fa85946ce4': '#c7f4b3', // Andrea: Lime Green (was Sunny Yellow)
};

/**
 * Pure deterministic djb2 hash function on a string.
 */
function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

/**
 * Deterministically builds a collision-free color map for the given activeCaregivers list.
 * 1. Assigns manual color overrides first, reserving those colors so no one else receives them.
 * 2. Sorts remaining caregivers deterministically by ID so assignment order is completely stable.
 * 3. Computes the preferred hash index for each remaining caregiver.
 * 4. If that color is already claimed (by override or previous caregiver), walks forward (wrapping)
 *    to the next available color.
 */
export function buildCaregiverColorMap(activeCaregivers) {
    const colorMap = {};
    if (!activeCaregivers || !activeCaregivers.length) return colorMap;

    const assignedColors = new Set();

    // 1. Assign manual overrides first
    activeCaregivers.forEach(cg => {
        const overrideColor = MANUAL_COLOR_OVERRIDES[cg.id];
        if (overrideColor) {
            colorMap[cg.id] = overrideColor;
            assignedColors.add(overrideColor);
        }
    });

    // 2. Deterministically sort remaining caregivers by ID
    const remaining = activeCaregivers
        .filter(cg => !colorMap[cg.id])
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    // 3. Walk forward wrapping around until an untaken color is found
    remaining.forEach(cg => {
        const preferredIndex = hashString(String(cg.id)) % CAREGIVER_PALETTE.length;
        let chosenIndex = preferredIndex;

        for (let i = 0; i < CAREGIVER_PALETTE.length; i++) {
            const idx = (preferredIndex + i) % CAREGIVER_PALETTE.length;
            if (!assignedColors.has(CAREGIVER_PALETTE[idx])) {
                chosenIndex = idx;
                break;
            }
        }

        const color = CAREGIVER_PALETTE[chosenIndex];
        assignedColors.add(color);
        colorMap[cg.id] = color;
    });

    return colorMap;
}

/**
 * Looks up a caregiver's assigned color from the colorMap, checking manual overrides
 * and falling back to a deterministic hash if not present in the map.
 */
export function getCaregiverColor(caregiverId, colorMap = null) {
    if (!caregiverId) return '#f3f4f6';
    if (colorMap && colorMap[caregiverId]) {
        return colorMap[caregiverId];
    }
    if (MANUAL_COLOR_OVERRIDES[caregiverId]) {
        return MANUAL_COLOR_OVERRIDES[caregiverId];
    }
    const index = hashString(String(caregiverId)) % CAREGIVER_PALETTE.length;
    return CAREGIVER_PALETTE[index];
}
