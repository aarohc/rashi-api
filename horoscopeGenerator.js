/**
 * Horoscope SVG Generator
 * Supports multiple chart styles via options.chartType:
 * - "north-indian" (default): classic Indian square with triangular houses
 * - "circle": circular wheel with 12 sectors
 * - "box": simple 4x3 box grid
 */

// Sign names mapping
const signNames = {
  1: 'Aries', 2: 'Taurus', 3: 'Gemini', 4: 'Cancer',
  5: 'Leo', 6: 'Virgo', 7: 'Libra', 8: 'Scorpio',
  9: 'Sagittarius', 10: 'Capricorn', 11: 'Aquarius', 12: 'Pisces'
};

// Planet symbols/abbreviations
const planetSymbols = {
  'Su': '☉', 'Mo': '☽', 'Ma': '♂', 'Me': '☿',
  'Ju': '♃', 'Ve': '♀', 'Sa': '♄', 'Ra': '☊', 'Ke': '☋'
};

// Planet colors
const planetColors = {
  'Su': '#FFD700', 'Mo': '#C0C0C0', 'Ma': '#FF6347', 'Me': '#87CEEB',
  'Ju': '#FFA500', 'Ve': '#FFB6C1', 'Sa': '#708090', 'Ra': '#4B0082', 'Ke': '#800080'
};

/**
 * Generate horoscope SVG chart
 * @param {Object} rashiData - Rashi data from the API
 * @param {Object} birthChart - Full birth chart data from vedic-astrology
 * @param {Object} options - Chart options (size, chartType, etc.)
 * @returns {string} SVG string
 */
function generateHoroscopeSVG(rashiData, birthChart, options = {}) {
  const chartType = options.chartType || 'north-indian';
  const size = options.size || 800;

  // Group planets by house (common for all chart types)
  const planetsByHouse = {};
  const planetOrder = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];
  
  planetOrder.forEach(planetKey => {
    const planetName = getPlanetName(planetKey);
    if (rashiData[planetName]) {
      const house = rashiData[planetName].house_number || 1;
      if (!planetsByHouse[house]) {
        planetsByHouse[house] = [];
      }
      planetsByHouse[house].push({
        key: planetKey,
        name: planetName,
        sign: rashiData[planetName].current_sign,
        isRetro: rashiData[planetName].isRetro === 'true'
      });
    }
  });

  if (chartType === 'box') {
    return renderBoxChart(planetsByHouse, rashiData, size);
  }
  if (chartType === 'circle') {
    return renderCircularChart(planetsByHouse, rashiData, size);
  }

  // Default to North Indian style
  return renderNorthIndianChart(planetsByHouse, rashiData, size);
}

/**
 * Circular chart with 12 radial houses
 */
function renderCircularChart(planetsByHouse, rashiData, size) {
  const centerX = size / 2;
  const centerY = size / 2;
  const outerRadius = size * 0.4;
  const innerRadius = size * 0.18;
  const ringRadius = (outerRadius + innerRadius) / 2;

  // Precompute angles for 12 houses, starting from top and going clockwise
  const houseAngles = [];
  for (let i = 0; i < 12; i++) {
    houseAngles.push((i * 30 - 90) * (Math.PI / 180));
  }

  let svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .house-text { font-family: Arial, sans-serif; font-size: 12px; fill: #333; font-weight: bold; }
      .sign-text { font-family: Arial, sans-serif; font-size: 10px; fill: #666; }
      .planet-text { font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; }
      .retro { opacity: 0.7; }
      .house-line { stroke: #333; stroke-width: 1; }
      .circle-line { stroke: #333; stroke-width: 2; fill: none; }
    </style>
  </defs>

  <!-- Background circles -->
  <circle cx="${centerX}" cy="${centerY}" r="${outerRadius}" fill="#f9f9f9" stroke="#333" stroke-width="2"/>
  <circle cx="${centerX}" cy="${centerY}" r="${innerRadius}" fill="white" stroke="#333" stroke-width="2"/>
`;

  // Radial house lines
  houseAngles.forEach(angle => {
    const x1 = centerX + Math.cos(angle) * innerRadius;
    const y1 = centerY + Math.sin(angle) * innerRadius;
    const x2 = centerX + Math.cos(angle) * outerRadius;
    const y2 = centerY + Math.sin(angle) * outerRadius;
    svg += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="house-line"/>\n`;
  });

  // House numbers & Lagna sign
  houseAngles.forEach((angle, idx) => {
    const houseNum = idx + 1;
    const midAngle = angle + (15 * Math.PI / 180);
    const textRadius = (outerRadius + innerRadius) / 2;
    const x = centerX + Math.cos(midAngle) * textRadius;
    const y = centerY + Math.sin(midAngle) * textRadius;
    svg += `  <text x="${x}" y="${y - 4}" text-anchor="middle" class="house-text">${houseNum}</text>\n`;
  });

  const lagnaSign = rashiData.Ascendant?.current_sign || 1;
  svg += `  <text x="${centerX}" y="${centerY + 4}" text-anchor="middle" class="sign-text">${signNames[lagnaSign]}</text>\n`;

  // Planets in houses (place slightly towards outerRadius)
  Object.keys(planetsByHouse).forEach(houseNum => {
    const houseIndex = parseInt(houseNum, 10) - 1;
    const baseAngle = houseAngles[houseIndex];
    const planets = planetsByHouse[houseNum];

    planets.forEach((planet, idx) => {
      const planetAngle = baseAngle + (idx * 8 - (planets.length - 1) * 4) * (Math.PI / 180);
      const planetRadius = ringRadius + 10;
      const x = centerX + Math.cos(planetAngle) * planetRadius;
      const y = centerY + Math.sin(planetAngle) * planetRadius;

      const symbol = planetSymbols[planet.key] || planet.name.charAt(0);
      const color = planetColors[planet.key] || '#000';
      const retroClass = planet.isRetro ? ' retro' : '';
      svg += `  <text x="${x}" y="${y}" text-anchor="middle" class="planet-text${retroClass}" fill="${color}">${symbol}</text>\n`;
    });
  });

  // Title
  svg += `  <text x="${size / 2}" y="${size * 0.08}" text-anchor="middle" style="font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; fill: #333;">Circular Horoscope</text>\n`;

  svg += `</svg>`;
  return svg;
}

/**
 * Simple 4x3 box chart (fallback / alternate style)
 */
function renderBoxChart(planetsByHouse, rashiData, size) {
  const margin = size * 0.05;
  const innerSize = size - margin * 2;
  const cols = 4;
  const rows = 3;
  const cellWidth = innerSize / cols;
  const cellHeight = innerSize / rows;

  let svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .house-text { font-family: Arial, sans-serif; font-size: 12px; fill: #333; font-weight: bold; }
      .sign-text { font-family: Arial, sans-serif; font-size: 10px; fill: #666; }
      .planet-text { font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; }
      .retro { opacity: 0.7; }
      .house-rect { stroke: #333; stroke-width: 1.5; fill: #fafafa; }
      .chart-border { stroke: #333; stroke-width: 2; fill: none; }
    </style>
  </defs>
  
  <!-- Outer chart border -->
  <rect x="${margin}" y="${margin}" width="${innerSize}" height="${innerSize}" class="chart-border"/>
`;

  // Precompute house rectangles in a simple 4x3 grid:
  // Houses 1-4 top row, 5-8 middle row, 9-12 bottom row (left to right)
  const houseRects = {};
  for (let house = 1; house <= 12; house++) {
    const index = house - 1;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = margin + col * cellWidth;
    const y = margin + row * cellHeight;
    houseRects[house] = { x, y, width: cellWidth, height: cellHeight };

    // Draw house rectangle
    svg += `  <rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" class="house-rect"/>\n`;

    // House number in the top-left corner of the cell
    svg += `  <text x="${x + 8}" y="${y + 16}" class="house-text">${house}</text>\n`;
  }

  // Draw Lagna sign name in house 1
  const lagnaSign = rashiData.Ascendant?.current_sign || 1;
  const house1 = houseRects[1];
  svg += `  <text x="${house1.x + house1.width / 2}" y="${house1.y + 32}" text-anchor="middle" class="sign-text">${signNames[lagnaSign]}</text>\n`;

  // Draw planets in their respective houses
  Object.keys(planetsByHouse).forEach(houseNum => {
    const house = houseRects[houseNum];
    if (!house) return;
    const planets = planetsByHouse[houseNum];

    planets.forEach((planet, planetIndex) => {
      const x = house.x + 16;
      const y = house.y + 32 + planetIndex * 18;
      const symbol = planetSymbols[planet.key] || planet.name.charAt(0);
      const color = planetColors[planet.key] || '#000';
      const retroClass = planet.isRetro ? ' retro' : '';

      svg += `  <text x="${x}" y="${y}" class="planet-text${retroClass}" fill="${color}">${symbol}</text>\n`;
    });
  });

  // Add title
  svg += `  <text x="${size / 2}" y="${margin / 2 + 12}" text-anchor="middle" style="font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; fill: #333;">Vedic Horoscope Chart</text>\n`;

  // Add legend
  let legendY = size - 100;
  svg += `  <text x="20" y="${legendY}" style="font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; fill: #333;">Planets:</text>\n`;
  
  let legendX = 20;
  const legendItems = [
    { key: 'Su', name: 'Sun' }, { key: 'Mo', name: 'Moon' }, { key: 'Ma', name: 'Mars' },
    { key: 'Me', name: 'Mercury' }, { key: 'Ju', name: 'Jupiter' }, { key: 'Ve', name: 'Venus' },
    { key: 'Sa', name: 'Saturn' }, { key: 'Ra', name: 'Rahu' }, { key: 'Ke', name: 'Ketu' }
  ];
  
  legendItems.forEach((item, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = 20 + col * 120;
    const y = legendY + row * 20 + 15;
    const color = planetColors[item.key] || '#000';
    svg += `  <circle cx="${x}" cy="${y - 5}" r="6" fill="${color}" opacity="0.3"/>\n`;
    svg += `  <text x="${x + 12}" y="${y}" style="font-family: Arial, sans-serif; font-size: 10px; fill: #333;">${item.name}</text>\n`;
  });

  svg += `</svg>`;
  return svg;
}

/**
 * North Indian style chart: square with central diamond and triangular houses
 */
function renderNorthIndianChart(planetsByHouse, rashiData, size) {
  const margin = size * 0.08;
  const innerSize = size - margin * 2;
  const centerX = size / 2;
  const centerY = size / 2;
  const left = margin;
  const right = size - margin;
  const top = margin;
  const bottom = size - margin;

  const midTop = { x: centerX, y: top };
  const midRight = { x: right, y: centerY };
  const midBottom = { x: centerX, y: bottom };
  const midLeft = { x: left, y: centerY };

  let svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .house-text { font-family: Arial, sans-serif; font-size: 12px; fill: #333; font-weight: bold; }
      .sign-text { font-family: Arial, sans-serif; font-size: 10px; fill: #666; }
      .planet-text { font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; }
      .retro { opacity: 0.7; }
      .chart-border { stroke: #333; stroke-width: 2; fill: none; }
      .house-line { stroke: #333; stroke-width: 1; }
    </style>
  </defs>

  <!-- Outer square -->
  <rect x="${left}" y="${top}" width="${innerSize}" height="${innerSize}" class="chart-border"/>

  <!-- Central diamond -->
  <polygon points="
    ${midTop.x},${midTop.y}
    ${midRight.x},${midRight.y}
    ${midBottom.x},${midBottom.y}
    ${midLeft.x},${midLeft.y}
  " class="chart-border"/>
`;

  // Lines from diamond corners to outer corners (forming triangular houses)
  const corners = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom }
  ];
  const diamondPoints = [midTop, midRight, midBottom, midLeft];

  for (let i = 0; i < 4; i++) {
    const d = diamondPoints[i];
    const c1 = corners[i];
    const c2 = corners[(i + 1) % 4];
    svg += `  <line x1="${d.x}" y1="${d.y}" x2="${c1.x}" y2="${c1.y}" class="house-line"/>\n`;
    svg += `  <line x1="${d.x}" y1="${d.y}" x2="${c2.x}" y2="${c2.y}" class="house-line"/>\n`;
  }

  // Full diagonals connecting all outer corners (to match classic North Indian charts)
  svg += `  <line x1="${left}" y1="${top}" x2="${right}" y2="${bottom}" class="house-line"/>\n`;
  svg += `  <line x1="${right}" y1="${top}" x2="${left}" y2="${bottom}" class="house-line"/>\n`;

  // Approximate positions for 12 houses matching classic North Indian layout in the provided image:
  // Center diamond = H1, then houses wrap around as in the reference chart.
  const housePositions = {
    1:  { x: centerX,                 y: centerY },                           // Central diamond (Lagna)
    2:  { x: centerX,                 y: top + innerSize * 0.18 },            // Top diamond
    3:  { x: left + innerSize * 0.18, y: top + innerSize * 0.30 },            // Left upper triangle
    4:  { x: left + innerSize * 0.22, y: centerY },                           // Left middle quadrilateral
    5:  { x: left + innerSize * 0.18, y: bottom - innerSize * 0.30 },         // Left lower triangle
    6:  { x: left + innerSize * 0.30, y: bottom - innerSize * 0.08 },         // Bottom-left corner region
    7:  { x: centerX,                 y: bottom - innerSize * 0.18 },         // Bottom central diamond
    8:  { x: centerX + innerSize * 0.18, y: bottom - innerSize * 0.30 },      // Bottom central-right region
    9:  { x: right - innerSize * 0.18, y: bottom - innerSize * 0.30 },        // Bottom-right triangle
    10: { x: right - innerSize * 0.22, y: centerY },                          // Right middle quadrilateral
    11: { x: right - innerSize * 0.18, y: top + innerSize * 0.30 },           // Right upper triangle
    12: { x: centerX + innerSize * 0.18, y: top + innerSize * 0.18 }          // Top-right region
  };

  // House numbers
  Object.keys(housePositions).forEach(houseNum => {
    const pos = housePositions[houseNum];
    svg += `  <text x="${pos.x}" y="${pos.y - 8}" text-anchor="middle" class="house-text">${houseNum}</text>\n`;
  });

  // Lagna sign in House 1 (center diamond)
  const lagnaSign = rashiData.Ascendant?.current_sign || 1;
  const h1 = housePositions[1];
  svg += `  <text x="${h1.x}" y="${h1.y + 12}" text-anchor="middle" class="sign-text">${signNames[lagnaSign]}</text>\n`;

  // Planets in houses (stacked below house number inside each region)
  Object.keys(planetsByHouse).forEach(houseNum => {
    const pos = housePositions[houseNum];
    if (!pos) return;
    const planets = planetsByHouse[houseNum];

    planets.forEach((planet, index) => {
      const y = pos.y + 12 + index * 14;
      const symbol = planetSymbols[planet.key] || planet.name.charAt(0);
      const color = planetColors[planet.key] || '#000';
      const retroClass = planet.isRetro ? ' retro' : '';
      svg += `  <text x="${pos.x}" y="${y}" text-anchor="middle" class="planet-text${retroClass}" fill="${color}">${symbol}</text>\n`;
    });
  });

  // Title
  svg += `  <text x="${size / 2}" y="${margin / 2 + 12}" text-anchor="middle" style="font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; fill: #333;">North Indian Vedic Horoscope</text>\n`;

  svg += `</svg>`;
  return svg;
}

/**
 * Get planet name from key
 */
function getPlanetName(key) {
  const mapping = {
    'Su': 'Sun', 'Mo': 'Moon', 'Ma': 'Mars', 'Me': 'Mercury',
    'Ju': 'Jupiter', 'Ve': 'Venus', 'Sa': 'Saturn', 'Ra': 'Rahu', 'Ke': 'Ketu'
  };
  return mapping[key] || key;
}

module.exports = { generateHoroscopeSVG };

