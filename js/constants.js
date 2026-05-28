// Demographic 3D Map Constants and Configurations
// Expose constants globally for consumption by app.js

window.tourSteps = [
  {
    title: "1. Panorama Metropolitano",
    text: "Contempla la distribución completa del área metropolitana de Santa Cruz de la Sierra. La grilla 3D revela cómo la población se expande desde el núcleo central hacia los municipios satélites en un patrón dinámico e interconectado.",
    camera: new THREE.Vector3(485000, 7926000, 56000),
    target: new THREE.Vector3(485000, 8051000, 0)
  },
  {
    title: "2. Núcleo Urbano Central",
    text: "En el corazón de Santa Cruz de la Sierra, los primeros anillos demuestran la densidad de población más elevada. Aquí se concentran servicios comerciales, financieros e institucionales que atraen el mayor flujo humano de la región.",
    camera: new THREE.Vector3(480800, 8024000, 16000),
    target: new THREE.Vector3(480800, 8032000, 0)
  },
  {
    title: "3. Eje Warnes - Montero",
    text: "Hacia el norte, a lo largo del corredor industrial nacional, los municipios de Warnes y Montero registran un crecimiento acelerado. La grilla 3D evidencia la densidad urbana compacta y el auge fabril de este importante conector metropolitano.",
    camera: new THREE.Vector3(483200, 8056000, 14000),
    target: new THREE.Vector3(483200, 8075000, 0)
  },
  {
    title: "4. Expansión y el Río Piraí",
    text: "En el margen oeste, cruzando el río Piraí, Porongo y la zona residencial del Urubó demuestran una expansión baja en altura pero de gran extensión territorial, redefiniendo la frontera metropolitana y planteando nuevos retos de conectividad.",
    camera: new THREE.Vector3(472200, 8025000, 9000),
    target: new THREE.Vector3(478200, 8034000, 0)
  }
];

window.metroLabels = [
  { name: "PORTACHUELO", lon: -63.39571, lat: -17.35374, offset: [0, -118] },
  { name: "MONTERO", lon: -63.2505, lat: -17.3387, offset: [0, -118] },
  { name: "WARNES", lon: -63.16472, lat: -17.51028, offset: [0, -118] },
  { name: "SANTA CRUZ", lon: -63.18117, lat: -17.78629, offset: [0, -138] },
  { name: "PORONGO", x: 467455.30, y: 8025952.24, offset: [0, -96] },
  { name: "URUBO", x: 476391.01, y: 8037004.08, offset: [0, -92] },
  { name: "COTOCA", lon: -62.99694, lat: -17.75389, offset: [0, -118] },
  { name: "LA GUARDIA", lon: -63.33111, lat: -17.89194, offset: [0, -94] },
  { name: "EL TORNO", lon: -63.38417, lat: -17.99472, offset: [0, -92] },
  { name: "LA ANGOSTURA", lon: -63.5058, lat: -18.1625, offset: [0, -112] }
];
