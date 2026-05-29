var container = document.getElementById("view"),
      app = Q3D.application,
      gui = Q3D.gui;

    var homeView = {
      camera: new THREE.Vector3(485000, 7926000, 56000),
      target: new THREE.Vector3(485000, 8051000, 0)
    };

    var populationLayerId = 1;
    var currentThreshold = 0;
    var isTopDownView = false;
    var isolateSelectionActive = false;
    var isolatedColumnObject = null;
    var selectedColumnFootprint = null;
    var satelliteFocusMode = false;
    var compareModeActive = false;
    var comparedCells = [];
    var currentSelectedObject = null;
    function updateComparisonPanel() {}

    // Light and Dark Palettes
    var lightPalette = [0xf7fcf5, 0xe5f5e0, 0xc7e9c0, 0xa1d99b, 0x74c476, 0x31a354, 0x006d2c];
    var darkPalette = [0x1f1a3a, 0x481e64, 0x781c6d, 0xa81c60, 0xd02c40, 0xe8682c, 0xf2b84b];
    var isDarkMode = false; // Por defecto siempre empieza con el Modo Claro

    app.init(container);       // initialize viewer
    app.highlightMaterial = new THREE.MeshLambertMaterial({
      color: 0xff2d75,
      emissive: 0x7a0030,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide
    });

    var loadingSceneReady = false;
    var loadingBasemapReady = false;
    var loadingHideTimer = null;
    var loadingScreen = document.getElementById("progress");
    var loadingText = document.getElementById("loadingtext");

    function setLoadingText(message) {
      if (loadingText) {
        loadingText.textContent = message;
      }
    }

    function hideLoadingScreen(force) {
      if (!loadingScreen || loadingScreen.classList.contains("is-hidden")) return;
      if (!loadingSceneReady) return;
      if (!force && !loadingBasemapReady) return;

      setLoadingText("MAPA LISTO");

      window.setTimeout(function () {
        loadingScreen.classList.add("is-hidden");
        loadingScreen.setAttribute("aria-hidden", "true");
      }, 250);
    }

    function markLoadingBasemapReady(message) {
      loadingBasemapReady = true;
      if (message) {
        setLoadingText(message);
      }
      hideLoadingScreen(false);
    }

    app.addEventListener("sceneLoaded", function () {
      loadingSceneReady = true;
      setLoadingText("PREPARANDO MAPA BASE");
      hideLoadingScreen(false);

      window.clearTimeout(loadingHideTimer);
      loadingHideTimer = window.setTimeout(function () {
        hideLoadingScreen(true);
      }, 9000);
    }, true);

    // Override highlightFeature to hide the solid 3D highlight object in 2D satellite focus mode
    var originalHighlightFeature = app.highlightFeature;
    app.highlightFeature = function (object) {
      originalHighlightFeature.apply(app, arguments);
      if (app.highlightObject && satelliteFocusMode) {
        app.highlightObject.visible = false;
      }
    };

    document.getElementById("homebtn").title = "Vista principal";
    document.getElementById("homebtn").setAttribute("aria-label", "Vista principal");
    document.getElementById("layerbtn").title = "Capas";
    document.getElementById("layerbtn").setAttribute("aria-label", "Capas");
    document.getElementById("infobtn").title = "Informacion";
    document.getElementById("infobtn").setAttribute("aria-label", "Informacion");
    document.getElementById("mapnote").addEventListener("mousedown", function (event) {
      event.stopPropagation();
    });
    document.getElementById("mapnote").addEventListener("click", function (event) {
      event.stopPropagation();
    });
    document.getElementById("layertoggle").addEventListener("click", toggleMobileLayerControls);
    document.getElementById("layerscrim").addEventListener("click", closeMobileLayerControls);
    document.getElementById("mapnoteToggle").addEventListener("click", toggleMapNoteText);
    
    document.getElementById("desktop-layer-toggle").addEventListener("click", function (event) {
      event.stopPropagation();
      var controls = document.getElementById("layercontrols");
      if (controls) {
        controls.classList.toggle("collapsed");
        var expanded = !controls.classList.contains("collapsed");
        this.setAttribute("aria-expanded", expanded ? "true" : "false");
        this.classList.toggle("active", expanded);
      }
    });

    document.addEventListener("click", function (event) {
      if (window.innerWidth > 720) {
        var controls = document.getElementById("layercontrols");
        var toggle = document.getElementById("desktop-layer-toggle");
        if (controls && !controls.classList.contains("collapsed")) {
          if (!controls.contains(event.target) && !toggle.contains(event.target)) {
            controls.classList.add("collapsed");
            toggle.setAttribute("aria-expanded", "false");
            toggle.classList.remove("active");
          }
        }
      }
    });

    document.querySelector("#designcredit a").addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      window.open(this.href, "_blank", "noopener");
    });
    window.addEventListener("resize", function () {
      syncMobileOverlayLayout();
      syncPopulationPopupPosition();
    });
    window.addEventListener("orientationchange", function () {
      setTimeout(function () {
        syncMobileOverlayLayout();
        syncPopulationPopupPosition();
      }, 180);
    });
    document.getElementById("activeLayerSelect").addEventListener("change", applyActiveLayer);
    document.getElementById("homeviewbtn").addEventListener("click", goHomeView);
    document.getElementById("closebtn").addEventListener("click", clearPopulationPopupState);
    document.getElementById("statsclose").addEventListener("click", closeStatsPanel);
    document.getElementById("isolateColumnBtn").addEventListener("click", toggleColumnIsolationMode);
    document.getElementById("resetIsolationBtn").addEventListener("click", clearColumnIsolation);
    document.getElementById("pitchupbtn").addEventListener("click", function () { adjustCameraPitch(0.12); });
    document.getElementById("pitchdownbtn").addEventListener("click", function () { adjustCameraPitch(-0.12); });
    document.getElementById("zoominbtn").addEventListener("click", function () { zoomCamera(0.78); });
    document.getElementById("zoomoutbtn").addEventListener("click", function () { zoomCamera(1.28); });
    document.getElementById("orbitnavbtn").addEventListener("click", toggleOrbit);
    document.getElementById("topviewbtn").addEventListener("click", topDownView);
    document.getElementById("legendtoggle").addEventListener("click", toggleMobileLegend);

    // Theme Toggle listener
    document.addEventListener("DOMContentLoaded", function () {
      var themebtn = document.getElementById("themebtn");
      if (themebtn) {
        themebtn.addEventListener("click", toggleTheme);
      }
      syncThemeToggleLabels();
      updateLegendColors();
    });

    syncMobileOverlayLayout();

    var originalLoadData = app.loadData;
    app.loadData = function (data) {
      if (data && data.type === "scene" && Array.isArray(data.layers)) {
        data.layers = data.layers.filter(function (layer) {
          return layer.properties && layer.properties.name !== "regiones_y_municipios_santa_cruz";
        });

        data.layers.forEach(function (layer) {
          if (!layer.properties) return;

          if (layer.properties.name === "rio_pirai") {
            layer.properties.name = "Rio Piraí";
          }

          if (layer.properties.name === "Metropolitana \u2014 Poblacion_Metropoli_UTM") {
            layer.properties.name = "Población";
            layer.properties.propertyNames = ["Poblacion", "Rango"];
            if (layer.body && Array.isArray(layer.body.materials)) {
              var palette = isDarkMode ? darkPalette : lightPalette;
              layer.body.materials.forEach(function (material, index) {
                material.c = palette[index] || palette[palette.length - 1];
              });
            }
          }
        });
      }

      if (data && data.type === "block" && data.layer === 1 && Array.isArray(data.features)) {
        data.features.forEach(function (feature) {
          var population = feature.geom && Number.isFinite(feature.geom.h) ? feature.geom.h : 0;
          feature.prop = [
            Math.round(population).toLocaleString("es-BO") + " habitantes",
            populationRange(population)
          ];
        });
      }

      originalLoadData.call(app, data);
    };

    function populationRange(population) {
      if (population < 187) return "Muy bajo";
      if (population < 493) return "Bajo";
      if (population < 899) return "Medio-bajo";
      if (population < 1368) return "Medio";
      if (population < 1912) return "Medio-alto";
      if (population < 3307) return "Alto";
      return "Muy alto";
    }

    function parsePopulation(value) {
      if (!value) return 0;
      return Number(String(value).replace(/[^\d]/g, "")) || 0;
    }

    function syncMobileOverlayLayout() {
      var root = document.documentElement;
      syncMobileLayerControlsState();
      syncMobileLegendState();

      var controls = document.getElementById("layercontrols");
      if (controls) {
        if (window.innerWidth > 720) {
          if (controls.parentElement !== document.body) {
            document.body.appendChild(controls);
          }
        } else {
          var select = document.getElementById("activeLayerSelect");
          if (select && controls.parentElement !== select.parentElement) {
            select.insertAdjacentElement("afterend", controls);
          }
        }
      }

      if (window.innerWidth > 720) {
        root.style.removeProperty("--mobile-note-top");
        root.style.removeProperty("--mobile-popups-top");
        root.style.removeProperty("--mobile-legend-bottom");
        root.style.removeProperty("--mobile-bottom-ui");
        root.style.removeProperty("--mobile-layer-button-top");
        return;
      }

      var header = document.getElementById("header");
      var mapnote = document.getElementById("mapnote");
      var nav = document.getElementById("nav3d");
      var topGap = window.innerWidth <= 480 ? 6 : 8;
      var bottomGap = window.innerWidth <= 480 ? 10 : 12;
      var headerBottom = header.getBoundingClientRect().bottom;
      var navHeight = nav.offsetHeight;
      var noteTop = Math.ceil(headerBottom + topGap);

      root.style.setProperty("--mobile-note-top", noteTop + "px");
      root.style.setProperty("--mobile-legend-bottom", Math.ceil(navHeight + bottomGap + 8) + "px");
      root.style.setProperty("--mobile-bottom-ui", Math.ceil(navHeight + bottomGap + 18) + "px");

      requestAnimationFrame(function () {
        var noteBottom = mapnote.getBoundingClientRect().bottom;
        root.style.setProperty("--mobile-layer-button-top", Math.ceil(noteBottom + 12) + "px");
        root.style.setProperty("--mobile-popups-top", Math.ceil(noteBottom + topGap) + "px");
      });
    }

    function syncMobileLayerControlsState() {
      var brand = document.getElementById("appbrand");
      var toggle = document.getElementById("layertoggle");
      var scrim = document.getElementById("layerscrim");
      if (!brand || !toggle) return;

      if (window.innerWidth > 720) {
        brand.classList.remove("controls-collapsed");
        toggle.setAttribute("aria-expanded", "true");
        if (scrim) scrim.classList.remove("open");
        return;
      }

      if (!brand.dataset.userToggledControls) {
        brand.classList.add("controls-collapsed");
      }

      var collapsed = brand.classList.contains("controls-collapsed");
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggle.setAttribute("aria-label", collapsed ? "Abrir capas" : "Cerrar capas");
      if (scrim) scrim.classList.toggle("open", !collapsed);
    }

    function toggleMobileLayerControls() {
      var brand = document.getElementById("appbrand");
      if (!brand) return;

      brand.dataset.userToggledControls = "true";
      brand.classList.toggle("controls-collapsed");
      syncMobileLayerControlsState();
      syncMobileOverlayLayout();
    }

    function closeMobileLayerControls() {
      var brand = document.getElementById("appbrand");
      if (!brand || window.innerWidth > 720) return;

      brand.dataset.userToggledControls = "true";
      brand.classList.add("controls-collapsed");
      syncMobileLayerControlsState();
      syncMobileOverlayLayout();
    }

    function syncMobileLegendState() {
      var legend = document.getElementById("heightlegend");
      var toggle = document.getElementById("legendtoggle");
      if (!legend || !toggle) return;

      if (window.innerWidth > 720) {
        legend.classList.remove("collapsed");
        toggle.setAttribute("aria-expanded", "true");
        return;
      }

      if (!legend.dataset.userToggled) {
        legend.classList.add("collapsed");
      }

      var expanded = !legend.classList.contains("collapsed");
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.setAttribute("aria-label", expanded ? "Ocultar leyenda" : "Mostrar leyenda");
    }

    function toggleMobileLegend() {
      var legend = document.getElementById("heightlegend");
      if (!legend) return;

      legend.dataset.userToggled = "true";
      legend.classList.toggle("collapsed");
      syncMobileLegendState();
      syncMobileOverlayLayout();
    }

    function toggleMapNoteText() {
      var note = document.getElementById("mapnote");
      var toggle = document.getElementById("mapnoteToggle");
      var expanded = !note.classList.contains("expanded");

      note.classList.toggle("expanded", expanded);
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.textContent = expanded ? "Ver menos" : "Ver mas";
      syncMobileOverlayLayout();
    }

    function applyPopulationThreshold() {
      if (!app.sceneLoaded || !app.scene || !app.scene.mapLayers[populationLayerId]) return;

      app.scene.mapLayers[populationLayerId].objectGroup.traverse(function (object) {
        if (!object.userData || !object.userData.properties) return;

        var population = parsePopulation(object.userData.properties[0]);
        object.visible = isolatedColumnObject ? object === isolatedColumnObject : population >= currentThreshold;
      });

      app.render();
    }

    function setPopulation2DMode(enabled) {
      if (!app.sceneLoaded || !app.scene || !app.scene.mapLayers[populationLayerId]) return;

      app.scene.mapLayers[populationLayerId].objectGroup.traverse(function (object) {
        if (!object.userData || !object.userData.properties) return;

        if (object.userData.originalScaleZ === undefined) {
          object.userData.originalScaleZ = object.scale.z;
        }

        // Restore original scale X and Y to prevent footprint outline mismatch
        if (object.userData.originalScaleX !== undefined) {
          object.scale.x = object.userData.originalScaleX;
        }
        if (object.userData.originalScaleY !== undefined) {
          object.scale.y = object.userData.originalScaleY;
        }

        object.scale.z = enabled ? 0.018 : object.userData.originalScaleZ;

        // Use the original population color in 2D, with light transparency over the basemap.
        if (object.material) {
          var materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(function (material) {
            if (material.userData.originalTransparent === undefined) {
              material.userData.originalTransparent = material.transparent;
              material.userData.originalOpacity = material.opacity;
              material.userData.originalDepthWrite = material.depthWrite;
            }

            material.transparent = enabled ? true : material.userData.originalTransparent;
            material.opacity = enabled ? 0.55 : material.userData.originalOpacity;
            material.depthWrite = enabled ? false : material.userData.originalDepthWrite;
            material.needsUpdate = true;
          });
        }

        object.updateMatrix();
        object.updateMatrixWorld(true);
      });

      app.render();
    }

    function syncIsolationControls() {
      var isolateBtn = document.getElementById("isolateColumnBtn");
      if (!isolateBtn) return;

      isolateBtn.classList.toggle("active", isolateSelectionActive);
      isolateBtn.setAttribute("aria-pressed", isolateSelectionActive ? "true" : "false");
      var labelText = isolateSelectionActive ? "Seleccione columna" : "Aislar columna";
      isolateBtn.setAttribute("data-tooltip", labelText);
      isolateBtn.setAttribute("aria-label", labelText);
    }

    function toggleColumnIsolationMode() {
      if (app.selectedObject && app.selectedObject.userData && app.selectedObject.userData.layerId === populationLayerId) {
        isolateColumn(app.selectedObject);
        return;
      }

      isolateSelectionActive = !isolateSelectionActive;
      syncIsolationControls();
    }

    function isolateColumn(object) {
      if (!object || !object.userData || !object.userData.properties) return;

      isolatedColumnObject = object;
      isolateSelectionActive = false;
      syncIsolationControls();
      applyPopulationThreshold();
    }

    function clearColumnFootprint() {
      if (!selectedColumnFootprint || !app.scene) return;

      selectedColumnFootprint.traverse(function (child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      app.scene.remove(selectedColumnFootprint);
      selectedColumnFootprint = null;
    }

    function showColumnFootprint(object) {
      if (!object || !app.scene) return;

      clearColumnFootprint();

      var box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return;

      var center = new THREE.Vector3();
      var size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);

      var width = Math.max(size.x, app.scene.userData.baseExtent.width * 0.002);
      var height = Math.max(size.y, app.scene.userData.baseExtent.width * 0.002);
      var group = new THREE.Group();

      var borderMesh;
      if (satelliteFocusMode) {
        // Draw a premium flat hollow 2D frame with physical thickness (8 meters) 
        // to bypass WebGL line-width limitations (1px on Windows/Chrome).
        var thickness = 8; 
        var shape = new THREE.Shape();
        
        // Outer box
        shape.moveTo(-width/2 - thickness, -height/2 - thickness);
        shape.lineTo(width/2 + thickness, -height/2 - thickness);
        shape.lineTo(width/2 + thickness, height/2 + thickness);
        shape.lineTo(-width/2 - thickness, height/2 + thickness);
        shape.closePath();

        // Inner box cutout
        var hole = new THREE.Path();
        hole.moveTo(-width/2, -height/2);
        hole.lineTo(width/2, -height/2);
        hole.lineTo(width/2, height/2);
        hole.lineTo(-width/2, height/2);
        hole.closePath();
        shape.holes.push(hole);

        var geometry = new THREE.ShapeBufferGeometry(shape);
        var material = new THREE.MeshBasicMaterial({
          color: 0x00f0ff, // Electric Neon Cyan
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95
        });
        borderMesh = new THREE.Mesh(geometry, material);
      } else {
        // Standard 3D view outline
        var geometry = new THREE.PlaneBufferGeometry(width, height);
        borderMesh = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({
            color: 0xd81b60,
            linewidth: 2
          })
        );
      }

      group.name = "Selected population cell footprint";
      // Use flat Z position when in 2D satellite focus mode to prevent parallax issues
      var zPos = satelliteFocusMode ? 2 : Math.max(box.max.z + 20, 60);
      group.position.set(center.x, center.y, zPos);
      group.renderOrder = 2000;
      group.add(borderMesh);
      selectedColumnFootprint = group;
      app.scene.add(group);
      app.render();
    }

    function setIsolatedColumnVisible(visible) {
      if (!isolatedColumnObject) return;
      isolatedColumnObject.visible = visible;
      isolatedColumnObject.traverse(function (child) {
        child.visible = visible;
      });
    }

    function showColumnIn2D(object) {
      if (!object || !app.sceneLoaded || !app.camera || !app.controls) return;

      satelliteFocusMode = true;
      isolateColumn(object);
      setIsolatedColumnVisible(false);

      // Hide the solid highlight object so that only the outline is visible
      if (app.highlightObject) {
        app.highlightObject.visible = false;
      }

      isTopDownView = true;
      set2DNavigationMode(true);
      setPopulation2DMode(true);
      showColumnFootprint(object);
      document.getElementById("topviewbtn").textContent = "3D";
      document.getElementById("topviewbtn").classList.add("active");
      zoomToSelectedColumn();
      setTimeout(function () {
        updateDynamicBasemap(true);
      }, 500);
    }

    function selectedPopulationColumn() {
      if (isolatedColumnObject) return isolatedColumnObject;
      if (app.selectedObject && app.selectedObject.userData && app.selectedObject.userData.layerId === populationLayerId) {
        return app.selectedObject;
      }
      return null;
    }

    function zoomToSelectedColumn() {
      if (!app.sceneLoaded || !app.camera || !app.controls) return;

      var object = selectedPopulationColumn();
      if (!object) return;

      var box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return;

      var center = new THREE.Vector3();
      var size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);

      var radius = Math.max(size.x, size.y, size.z, app.scene.userData.baseExtent.width * 0.018);
      // Zoom closer in 2D satellite focus mode to clearly show streets and houses around the selected cell
      var distance = satelliteFocusMode ? Math.max(Math.max(size.x, size.y) * 4.5, 950) : Math.max(radius * 5.5, 2200);
      var endTarget = center.clone();
      var endCam = isTopDownView
        ? new THREE.Vector3(center.x, center.y, distance)
        : new THREE.Vector3(center.x - distance * 0.25, center.y - distance * 0.78, center.z + distance * 0.62);

      flyTo(endCam, endTarget, function () {
        if (isTopDownView) set2DNavigationMode(true);
      });
    }

    function clearColumnIsolation(renderNow) {
      setIsolatedColumnVisible(true);
      isolatedColumnObject = null;
      isolateSelectionActive = false;
      syncIsolationControls();
      clearColumnFootprint();

      if (renderNow === false) return;
      applyPopulationThreshold();

    }

    function applyActiveLayer() {
      if (!app.sceneLoaded || !app.scene) return;

      var value = document.getElementById("activeLayerSelect").value;
      if (app.scene.mapLayers[populationLayerId]) {
        app.scene.mapLayers[populationLayerId].objectGroup.visible = value === "all" || value === "population";
      }
      if (app.scene.mapLayers[0]) {
        app.scene.mapLayers[0].objectGroup.visible = value === "all" || value === "river";
      }
      app.render();
    }

    function createLayerControls() {
      var select = document.getElementById("activeLayerSelect");
      if (!select || document.getElementById("layercontrols")) return;

      var controls = document.createElement("div");
      controls.id = "layercontrols";
      controls.setAttribute("aria-label", "Lista de capas");

      if (window.innerWidth > 720) {
        controls.classList.add("collapsed");
        document.body.appendChild(controls);
      } else {
        select.insertAdjacentElement("afterend", controls);
      }

      var sheetHeader = document.createElement("div");
      var sheetTitle = document.createElement("h2");
      var sheetClose = document.createElement("button");
      sheetHeader.className = "layer-sheet-header";
      sheetTitle.textContent = "Capas del mapa";
      sheetClose.id = "layerSheetClose";
      sheetClose.type = "button";
      sheetClose.textContent = "X";
      sheetClose.setAttribute("aria-label", "Cerrar capas");
      sheetClose.addEventListener("click", closeMobileLayerControls);
      sheetHeader.appendChild(sheetTitle);
      sheetHeader.appendChild(sheetClose);
      controls.appendChild(sheetHeader);

      syncThemeToggleLabels();

      [
        { id: populationLayerId, name: "Poblacion", symbol: "population" },
        { id: 0, name: "Rio Pirai", symbol: "river" }
      ].forEach(function (item) {
        var row = document.createElement("div");
        row.className = "layer-control";

        var label = document.createElement("label");
        var checkbox = document.createElement("input");
        var symbol = document.createElement("span");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.addEventListener("change", function () {
          setLayerVisibility(item.id, checkbox.checked);
        });
        symbol.className = "layer-symbol " + item.symbol;

        label.appendChild(symbol);
        label.appendChild(document.createTextNode(item.name));

        row.appendChild(label);
        row.appendChild(checkbox);
        controls.appendChild(row);
      });

      syncMobileOverlayLayout();
    }

    function setLayerVisibility(layerId, visible) {
      if (layerId === "basemap") {
        var basemap = app.scene && app.scene.getObjectByName ? app.scene.getObjectByName("CARTO Positron basemap without labels") : null;
        if (basemap) basemap.visible = visible;
        app.render();
        return;
      }

      if (!app.sceneLoaded || !app.scene.mapLayers[layerId]) return;
      app.scene.mapLayers[layerId].objectGroup.visible = visible;
      app.render();
    }

    function setLayerOpacity(layerId, opacity) {
      if (layerId === "basemap") {
        var basemap = app.scene && app.scene.getObjectByName ? app.scene.getObjectByName("CARTO Positron basemap without labels") : null;
        if (basemap && basemap.material) {
          basemap.material.transparent = opacity < 1;
          basemap.material.opacity = opacity;
          basemap.material.needsUpdate = true;
        }
        app.render();
        return;
      }

      if (!app.sceneLoaded || !app.scene.mapLayers[layerId]) return;

      app.scene.mapLayers[layerId].objectGroup.traverse(function (object) {
        if (!object.material) return;

        var materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(function (material) {
          material.transparent = opacity < 1;
          material.opacity = opacity;
          material.needsUpdate = true;
        });
      });

      app.render();
    }

    function loadActiveBasemap() {
      if (!app.scene) return;

      var styleUrl = isDarkMode
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
      var meshName = isDarkMode ? "CARTO Dark Matter basemap" : "CARTO Positron basemap";
      addBasemap(app.scene, styleUrl, meshName);
    }

    // Theme Toggle & Palettes Update
    function toggleTheme() {
      isDarkMode = !isDarkMode;
      if (isDarkMode) {
        document.documentElement.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
      }

      loadActiveBasemap();

      update3DBarsPalette();
      syncThemeToggleLabels();
    }

    function syncThemeToggleLabels() {
      var mobileToggle = document.getElementById("layerThemeToggle");
      var headerToggle = document.getElementById("themebtn");
      var label = isDarkMode ? "Modo claro" : "Modo oscuro";

      if (mobileToggle) {
        mobileToggle.textContent = label;
        mobileToggle.setAttribute("aria-label", label);
      }

      if (headerToggle) {
        headerToggle.title = label;
        headerToggle.setAttribute("aria-label", label);
      }
    }

    function update3DBarsPalette() {
      if (!app.sceneLoaded || !app.scene || !app.scene.mapLayers[populationLayerId]) return;

      var palette = isDarkMode ? darkPalette : lightPalette;

      app.scene.mapLayers[populationLayerId].objectGroup.traverse(function (object) {
        if (!object.userData || !object.userData.properties) return;

        var range = object.userData.properties[1];
        var rangeIndex = 0;
        if (range === "Muy bajo") rangeIndex = 0;
        else if (range === "Bajo") rangeIndex = 1;
        else if (range === "Medio-bajo") rangeIndex = 2;
        else if (range === "Medio") rangeIndex = 3;
        else if (range === "Medio-alto") rangeIndex = 4;
        else if (range === "Alto") rangeIndex = 5;
        else if (range === "Muy alto") rangeIndex = 6;

        var colorHex = palette[rangeIndex] || palette[palette.length - 1];

        if (object.material) {
          var materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(function (material) {
            material.color.setHex(colorHex);
            material.needsUpdate = true;
          });
        }
      });

      updateLegendColors();
      app.render();
    }

    function updateLegendColors() {
      var palette = isDarkMode ? darkPalette : lightPalette;
      var root = document.documentElement;
      for (var i = 1; i <= 7; i++) {
        var colorHexStr = "#" + palette[i - 1].toString(16).padStart(6, '0');
        root.style.setProperty("--legend-r" + i, colorHexStr);
      }
    }

    // Raycasting & Hover Tooltips
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    var hoveredObject = null;
    var tooltipNode = null;

    function createTooltip() {
      tooltipNode = document.createElement("div");
      tooltipNode.id = "hover-tooltip";
      tooltipNode.style.position = "absolute";
      tooltipNode.style.pointerEvents = "none";
      tooltipNode.style.zIndex = "2500";
      tooltipNode.style.padding = "8px 12px";
      tooltipNode.style.border = "1px solid var(--border-panel)";
      tooltipNode.style.borderRadius = "8px";
      tooltipNode.style.background = "var(--bg-panel)";
      tooltipNode.style.color = "var(--text-primary)";
      tooltipNode.style.boxShadow = "0 10px 25px var(--shadow-panel)";
      tooltipNode.style.backdropFilter = "blur(10px)";
      tooltipNode.style.fontSize = "12px";
      tooltipNode.style.fontWeight = "650";
      tooltipNode.style.display = "none";
      tooltipNode.style.transition = "opacity 0.15s ease, transform 0.15s ease";
      tooltipNode.style.opacity = "0";
      tooltipNode.style.transform = "translate(-50%, -100%) translateY(-10px)";
      document.body.appendChild(tooltipNode);
    }

    document.addEventListener("DOMContentLoaded", function () {
      createTooltip();

      // Connect the Tour button
      var animbtn = document.getElementById("animbtn");
      if (animbtn) {
        animbtn.classList.remove("hidden");
        animbtn.title = "Iniciar Tour Demográfico";
        animbtn.setAttribute("aria-label", "Iniciar Tour Demográfico");
        animbtn.className = "playbtn";
        animbtn.addEventListener("click", startTour);
      }
    });

    container.addEventListener("mousemove", onMouseMove);

    function onMouseMove(event) {
      if (!app.sceneLoaded || !app.camera || !app.scene) return;

      // Disable hover tooltip on mobile/touch screens
      if (window.innerWidth <= 720 || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) {
        hideTooltip();
        return;
      }

      var rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      if (tooltipNode) {
        tooltipNode.style.left = event.clientX + "px";
        tooltipNode.style.top = event.clientY + "px";
      }

      raycaster.setFromCamera(mouse, app.camera);

      var popLayer = app.scene.mapLayers[populationLayerId];
      if (!popLayer || !popLayer.objectGroup || !popLayer.objectGroup.visible) {
        hideTooltip();
        return;
      }

      var intersects = raycaster.intersectObjects(popLayer.objectGroup.children, true);
      if (intersects.length > 0) {
        var intersect = intersects[0];
        var object = intersect.object;

        while (object && (!object.userData || !object.userData.properties)) {
          object = object.parent;
        }

        if (object && object.userData && object.userData.properties) {
          if (currentSelectedObject === object) {
            hideTooltip();
            return;
          }

          if (hoveredObject !== object) {
            hoveredObject = object;
            var props = object.userData.properties;
            var population = props[0] || "No disponible";
            var range = props[1] || "Sin rango";

            tooltipNode.innerHTML = "<div style='color: var(--accent-color); font-weight: 850; font-size: 14px; margin-bottom: 2px;'>" + population + "</div><div style='font-size: 11px; opacity: 0.8;'>Rango: " + range + "</div>";
            tooltipNode.style.display = "block";
            requestAnimationFrame(function () {
              tooltipNode.style.opacity = "1";
              tooltipNode.style.transform = "translate(-50%, -100%) translateY(-10px)";
            });
          }
          return;
        }
      }

      hideTooltip();
    }

    function hideTooltip() {
      if (hoveredObject) {
        hoveredObject = null;
        if (tooltipNode) {
          tooltipNode.style.opacity = "0";
          tooltipNode.style.transform = "translate(-50%, -100%) translateY(-5px)";
          setTimeout(function () {
            if (!hoveredObject) tooltipNode.style.display = "none";
          }, 150);
        }
      }
    }

    // Sparkline dynamic rendering
    function renderDynamicChart(popVal, range) {
      var sparkline = document.getElementById("sparkline");
      if (!sparkline) return;

      sparkline.innerHTML = "";

      var popNum = parsePopulation(popVal);
      var maxPop = 9940;
      var pct = Math.min(100, (popNum / maxPop) * 100);

      var bgBar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bgBar.setAttribute("x", "0");
      bgBar.setAttribute("y", "12");
      bgBar.setAttribute("width", "240");
      bgBar.setAttribute("height", "8");
      bgBar.setAttribute("rx", "4");
      bgBar.setAttribute("fill", "var(--border-divider)");
      sparkline.appendChild(bgBar);

      var valBar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      valBar.setAttribute("x", "0");
      valBar.setAttribute("y", "12");
      valBar.setAttribute("width", "0");
      valBar.setAttribute("height", "8");
      valBar.setAttribute("rx", "4");
      valBar.setAttribute("fill", "var(--accent-color)");
      valBar.style.transition = "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
      sparkline.appendChild(valBar);

      var labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      labelText.setAttribute("x", "0");
      labelText.setAttribute("y", "32");
      labelText.setAttribute("fill", "var(--text-secondary)");
      labelText.setAttribute("font-size", "10px");
      labelText.setAttribute("font-weight", "600");
      labelText.textContent = pct.toFixed(1) + "% de la densidad pico metropolitana";
      sparkline.appendChild(labelText);

      setTimeout(function () {
        valBar.setAttribute("width", (2.4 * pct).toFixed(1));
      }, 50);
    }



    // Camera cinematic fly
    var cameraAnimation = {
      active: false,
      startTime: 0,
      duration: 1800,
      startPos: new THREE.Vector3(),
      endPos: new THREE.Vector3(),
      startTarget: new THREE.Vector3(),
      endTarget: new THREE.Vector3(),
      callback: null
    };

    function animateCamera() {
      if (!cameraAnimation.active) return;

      var elapsed = performance.now() - cameraAnimation.startTime;
      var progress = Math.min(1, elapsed / cameraAnimation.duration);
      var t = (1 - Math.cos(progress * Math.PI)) / 2;

      app.camera.position.lerpVectors(cameraAnimation.startPos, cameraAnimation.endPos, t);
      if (app.controls.target !== undefined) {
        app.controls.target.lerpVectors(cameraAnimation.startTarget, cameraAnimation.endTarget, t);
      }

      app.camera.lookAt(app.controls.target);
      app.updateControlsAndRender();

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      } else {
        cameraAnimation.active = false;
        if (cameraAnimation.callback) cameraAnimation.callback();
      }
    }

    function flyTo(endCam, endTarget, callback) {
      if (!app.sceneLoaded || !app.camera || !app.controls) return;

      app.setRotateAnimationMode(false);
      document.getElementById("orbitnavbtn").classList.remove("active");

      cameraAnimation.startPos.copy(app.camera.position);
      cameraAnimation.endPos.copy(endCam);

      if (app.controls.target !== undefined) {
        cameraAnimation.startTarget.copy(app.controls.target);
      } else {
        cameraAnimation.startTarget.set(0, 0, 0);
      }
      cameraAnimation.endTarget.copy(endTarget);

      cameraAnimation.startTime = performance.now();
      cameraAnimation.active = true;
      cameraAnimation.callback = callback;

      animateCamera();
    }

    // Tour demographic narrative data
    var tourSteps = window.tourSteps;

    var currentTourStep = 0;

    function initStorytellingTour() {
      var narrativeBox = document.getElementById("narrativebox");
      if (!narrativeBox) return;

      narrativeBox.innerHTML = `
    <div id="tourHeader" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid var(--border-divider); padding-bottom:6px;">
      <span style="font-weight:800; font-size:11px; text-transform:uppercase; color:var(--accent-color); letter-spacing:0.04em;">Tour Demográfico</span>
      <button id="closeTourBtn" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-weight:700; font-size:13px;">×</button>
    </div>
    <div id="narbody">
      <h3 id="tourTitle" style="margin:4px 0 6px 0; font-size:14px; font-weight:800; color:var(--text-primary);"></h3>
      <p id="tourText" style="margin:0 0 12px 0; font-size:11px; line-height:1.45; color:var(--text-secondary);"></p>
    </div>
    <div id="tourControls" style="display:flex; justify-content:space-between; align-items:center;">
      <span id="tourProgress" style="font-size:10px; font-weight:700; color:var(--text-secondary);">1 / 4</span>
      <div style="display:flex; gap:6px;">
        <button id="tourPrevBtn" class="action-btn" style="margin:0; padding:4px 8px; font-size:11px;">Anterior</button>
        <button id="tourNextBtn" class="action-btn" style="margin:0; padding:4px 8px; font-size:11px; background:var(--accent-color); color:var(--badge-text); border-color:var(--accent-color);">Siguiente</button>
      </div>
    </div>
  `;

      document.getElementById("closeTourBtn").addEventListener("click", stopTour);
      document.getElementById("tourPrevBtn").addEventListener("click", prevTourStep);
      document.getElementById("tourNextBtn").addEventListener("click", nextTourStep);

      currentTourStep = 0;
      showTourStep(0);
    }

    function startTour() {
      var narrativeBox = document.getElementById("narrativebox");
      narrativeBox.classList.add("visible");
      initStorytellingTour();
    }

    function stopTour() {
      var narrativeBox = document.getElementById("narrativebox");
      narrativeBox.classList.remove("visible");
    }

    function showTourStep(index) {
      currentTourStep = index;
      var step = tourSteps[index];

      document.getElementById("tourTitle").textContent = step.title;
      document.getElementById("tourText").textContent = step.text;
      document.getElementById("tourProgress").textContent = (index + 1) + " / " + tourSteps.length;

      document.getElementById("tourPrevBtn").disabled = index === 0;
      document.getElementById("tourPrevBtn").style.opacity = index === 0 ? "0.4" : "1";

      var nextBtn = document.getElementById("tourNextBtn");
      if (index === tourSteps.length - 1) {
        nextBtn.textContent = "Finalizar";
      } else {
        nextBtn.textContent = "Siguiente";
      }

      var worldCam = mapVectorToWorld(step.camera);
      var worldTarget = mapVectorToWorld(step.target);

      flyTo(worldCam, worldTarget);
    }

    function nextTourStep() {
      if (currentTourStep < tourSteps.length - 1) {
        showTourStep(currentTourStep + 1);
      } else {
        stopTour();
        goHomeView();
      }
    }

    function prevTourStep() {
      if (currentTourStep > 0) {
        showTourStep(currentTourStep - 1);
      }
    }

    function updateStatsPanel(layer, object) {
      var panel = document.getElementById("statsPanel");
      var props = object && object.userData ? object.userData.properties || [] : [];
      var population = props[0] || "No disponible";
      var range = props[1] || "No disponible";

      document.getElementById("statPopulation").textContent = population;
      document.getElementById("statRange").textContent = range;
      document.getElementById("statDensity").textContent = "Por celda censal";
      document.getElementById("statVariation").textContent = "Sin serie 2012";
      panel.querySelector("h2").textContent = layer && layer.properties ? layer.properties.name : "Celda censal";

      renderDynamicChart(population, range);

      panel.classList.add("open");
    }

    function closeStatsPanel() {
      document.getElementById("statsPanel").classList.remove("open");
    }

    function columnLocationContext(object) {
      if (!object || !app.scene) return null;

      var box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return null;

      var center = new THREE.Vector3();
      box.getCenter(center);

      var origin = app.scene.userData.origin;
      var mapX = center.x + origin.x;
      var mapY = center.y + origin.y;
      var lonLat = utm20sToLonLat(mapX, mapY);
      var nearest = nearestMapReference(mapX, mapY);

      return {
        mapX: mapX,
        mapY: mapY,
        lon: lonLat[0],
        lat: lonLat[1],
        nearest: nearest
      };
    }

    function nearestMapReference(mapX, mapY) {
      var best = null;

      metroLabels.forEach(function (label) {
        var utm = label.x !== undefined && label.y !== undefined
          ? { x: label.x, y: label.y }
          : lonLatToUtm20s(label.lon, label.lat);
        var distance = Math.hypot(utm.x - mapX, utm.y - mapY);

        if (!best || distance < best.distance) {
          best = {
            name: label.name,
            distance: distance
          };
        }
      });

      return best;
    }

    function formatDistance(meters) {
      if (!Number.isFinite(meters)) return "Sin referencia";
      if (meters < 1000) return Math.round(meters) + " m";
      return (meters / 1000).toLocaleString("es-BO", { maximumFractionDigits: 1 }) + " km";
    }

    function showPopulationPopup(layer, object) {
      var props = object && object.userData ? object.userData.properties || [] : [];
      var population = props[0] || "No disponible";
      var range = props[1] || "Sin rango";
      var popup = document.getElementById("popup");
      var content = document.createElement("div");
      var summary = document.createElement("div");
      var value = document.createElement("p");
      var badge = document.createElement("span");
      var location = columnLocationContext(object);

      summary.className = "population-popup";
      value.className = "population-popup__value";
      badge.className = "population-popup__badge";

      value.textContent = population;
      badge.textContent = range;

      summary.appendChild(value);
      summary.appendChild(badge);
      content.appendChild(summary);

      if (location) {
        var context = document.createElement("div");
        var actions = document.createElement("div");
        var view2DButton = document.createElement("button");
        var zoomButton = document.createElement("button");

        context.className = "population-context";
        actions.className = "population-context__actions";

        view2DButton.type = "button";
        view2DButton.textContent = "Ver en 2D";
        view2DButton.addEventListener("click", function () {
          showColumnIn2D(object);
        });

        zoomButton.type = "button";
        zoomButton.textContent = "Zoom";
        zoomButton.addEventListener("click", function () {
          isolateColumn(object);
          zoomToSelectedColumn();
        });

        actions.appendChild(view2DButton);
        actions.appendChild(zoomButton);
        context.appendChild(actions);
        content.appendChild(context);
      }

      // On desktop, temporarily hide the map note to avoid overlap and free up space
      if (window.innerWidth > 720) {
        var mapnote = document.getElementById("mapnote");
        if (mapnote) mapnote.style.display = "none";
      }

      popup.classList.add("population-query-popup");
      syncPopulationPopupPosition();
      gui.popup.show(content, layer && layer.properties ? layer.properties.name : "Poblacion");
    }

    function syncPopulationPopupPosition() {
      var root = document.documentElement;
      var mapnote = document.getElementById("mapnote");
      var baseElement = mapnote && mapnote.style.display !== "none" ? mapnote : document.getElementById("header");
      var rect = baseElement.getBoundingClientRect();
      var topGap = window.innerWidth <= 720 ? 8 : 12;
      var topVal = rect.bottom + topGap;

      if (window.innerWidth > 720) {
        document.getElementById("popup").style.top = Math.ceil(topVal) + "px";
      } else {
        root.style.setProperty("--population-popup-top", Math.ceil(topVal) + "px");
      }
    }

    function clearPopulationPopupState() {
      currentSelectedObject = null;
      // Restore the map note on desktop
      if (window.innerWidth > 720) {
        var mapnote = document.getElementById("mapnote");
        if (mapnote) mapnote.style.display = "block";
      }

      var popup = document.getElementById("popup");
      popup.classList.remove("population-query-popup");
      popup.style.top = "";
      document.documentElement.style.removeProperty("--population-popup-top");
    }

    var originalCleanView = app.cleanView;
    app.cleanView = function () {
      originalCleanView.apply(app, arguments);
      clearColumnIsolation();
      clearPopulationPopupState();
      closeStatsPanel();
      document.getElementById("orbitnavbtn").classList.toggle("active", app.controls && app.controls.autoRotate);
    };

    gui.showQueryResult = function (point, layer, obj) {
      if (layer && layer.id === populationLayerId) {
        currentSelectedObject = obj;
        hideTooltip();
        if (isolateSelectionActive) {
          isolateColumn(obj);
        }

        if (compareModeActive) {
          if (comparedCells.length >= 2) {
            comparedCells.shift();
          }
          comparedCells.push({ layer: layer, object: obj });
          updateComparisonPanel();
          showPopulationPopup(layer, obj);
        } else {
          if (satelliteFocusMode) {
            // Automatically focus, outline, and isolate the new clicked cell when in 2D satellite focus mode
            showColumnIn2D(obj);
          }
          updateStatsPanel(layer, obj);
          showPopulationPopup(layer, obj);
        }
      }
      else {
        if (!compareModeActive) {
          closeStatsPanel();
          clearPopulationPopupState();
          gui.popup.hide();
        }
      }
    };

    Q3D.Config.viewpoint.pos = homeView.camera.clone();
    Q3D.Config.viewpoint.lookAt = homeView.target.clone();

    function mapVectorToWorld(vector) {
      var point = app.scene.toWorldCoordinates({ x: vector.x, y: vector.y, z: vector.z });
      return new THREE.Vector3(point.x, point.y, point.z);
    }

    function goHomeView() {
      if (!app.sceneLoaded || !app.camera || !app.controls) return;

      set2DNavigationMode(false);
      var camera = mapVectorToWorld(homeView.camera);
      var target = mapVectorToWorld(homeView.target);

      flyTo(camera, target, function () {
        app.cleanView();
      });
      isTopDownView = false;
      satelliteFocusMode = false;
      setIsolatedColumnVisible(true);
      setPopulation2DMode(false);
      clearColumnFootprint();
      document.getElementById("topviewbtn").textContent = "2D";
      document.getElementById("topviewbtn").classList.remove("active");
    }

    document.getElementById("homebtn").addEventListener("click", goHomeView);

    function set2DNavigationMode(enabled) {
      if (!app.controls) return;

      app.controls.enableRotate = !enabled;
      app.controls.enablePan = true;
      app.controls.enableZoom = true;
      app.controls.autoRotate = false;
      app.controls.mouseLeftButtonPan = enabled;
      app.controls.touchOneFingerPan = enabled;
      app.controls.screenSpacePanning = enabled;

      if (enabled) {
        app.controls.minPolarAngle = 0;
        app.controls.maxPolarAngle = 0;
      } else {
        app.controls.minPolarAngle = 0;
        app.controls.maxPolarAngle = Math.PI;
      }

      app.controls.update();
      document.getElementById("orbitnavbtn").classList.remove("active");
    }

    function zoomCamera(scale) {
      if (!app.sceneLoaded || !app.camera || !app.controls) return;

      var target = app.controls.target;
      var offset = app.camera.position.clone().sub(target).multiplyScalar(scale);

      var endCam = target.clone().add(offset);
      flyTo(endCam, target);
    }

    function adjustCameraPitch(delta) {
      if (!app.sceneLoaded || !app.camera || !app.controls) return;
      if (isTopDownView) return;

      var target = app.controls.target;
      var offset = app.camera.position.clone().sub(target);
      var horizontal = Math.sqrt(offset.x * offset.x + offset.y * offset.y);
      var distance = offset.length();
      var angle = Math.atan2(offset.z, horizontal);
      var next = Math.max(0.18, Math.min(1.28, angle + delta));
      var newHorizontal = Math.cos(next) * distance;
      var ratio = horizontal ? newHorizontal / horizontal : 1;

      offset.x *= ratio;
      offset.y *= ratio;
      offset.z = Math.sin(next) * distance;

      var endCam = target.clone().add(offset);
      flyTo(endCam, target);
    }

    function topDownView() {
      if (!app.sceneLoaded || !app.camera || !app.controls) return;

      if (isTopDownView) {
        goHomeView();
        return;
      }

      var target = app.controls.target.clone();
      var endCam = new THREE.Vector3(target.x, target.y, app.scene.userData.baseExtent.width * 0.9);

      flyTo(endCam, target, function () {
        isTopDownView = true;
        set2DNavigationMode(true);
        setPopulation2DMode(true);
        document.getElementById("topviewbtn").textContent = "3D";
        document.getElementById("topviewbtn").classList.add("active");
      });
    }

    function toggleOrbit() {
      if (!app.sceneLoaded || !app.controls) return;
      if (isTopDownView) return;

      var enabled = !app.controls.autoRotate;
      app.setRotateAnimationMode(enabled);
      document.getElementById("orbitnavbtn").classList.toggle("active", enabled);
    }



    function utm20sToLonLat(easting, northing) {
      var a = 6378137;
      var f = 1 / 298.257223563;
      var k0 = 0.9996;
      var e = Math.sqrt(f * (2 - f));
      var e1sq = e * e / (1 - e * e);
      var x = easting - 500000;
      var y = northing - 10000000;
      var lonOrigin = -63;
      var m = y / k0;
      var mu = m / (a * (1 - Math.pow(e, 2) / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));
      var e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
      var j1 = 3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32;
      var j2 = 21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32;
      var j3 = 151 * Math.pow(e1, 3) / 96;
      var j4 = 1097 * Math.pow(e1, 4) / 512;
      var fp = mu + j1 * Math.sin(2 * mu) + j2 * Math.sin(4 * mu) + j3 * Math.sin(6 * mu) + j4 * Math.sin(8 * mu);
      var c1 = e1sq * Math.pow(Math.cos(fp), 2);
      var t1 = Math.pow(Math.tan(fp), 2);
      var r1 = a * (1 - e * e) / Math.pow(1 - e * e * Math.pow(Math.sin(fp), 2), 1.5);
      var n1 = a / Math.sqrt(1 - e * e * Math.pow(Math.sin(fp), 2));
      var d = x / (n1 * k0);
      var q1 = n1 * Math.tan(fp) / r1;
      var q2 = d * d / 2;
      var q3 = (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * e1sq) * Math.pow(d, 4) / 24;
      var q4 = (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * e1sq - 3 * c1 * c1) * Math.pow(d, 6) / 720;
      var lat = fp - q1 * (q2 - q3 + q4);
      var q5 = d;
      var q6 = (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6;
      var q7 = (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * e1sq + 24 * t1 * t1) * Math.pow(d, 5) / 120;
      var lon = (q5 - q6 + q7) / Math.cos(fp);

      return [lonOrigin + lon * 180 / Math.PI, lat * 180 / Math.PI];
    }

    function lonLatToUtm20s(lon, lat) {
      var a = 6378137;
      var f = 1 / 298.257223563;
      var k0 = 0.9996;
      var e = Math.sqrt(f * (2 - f));
      var ePrimeSq = e * e / (1 - e * e);
      var latRad = lat * Math.PI / 180;
      var lonRad = lon * Math.PI / 180;
      var lonOriginRad = -63 * Math.PI / 180;
      var n = a / Math.sqrt(1 - e * e * Math.sin(latRad) * Math.sin(latRad));
      var t = Math.tan(latRad) * Math.tan(latRad);
      var c = ePrimeSq * Math.cos(latRad) * Math.cos(latRad);
      var aa = Math.cos(latRad) * (lonRad - lonOriginRad);
      var m = a * (
        (1 - e * e / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256) * latRad
        - (3 * e * e / 8 + 3 * Math.pow(e, 4) / 32 + 45 * Math.pow(e, 6) / 1024) * Math.sin(2 * latRad)
        + (15 * Math.pow(e, 4) / 256 + 45 * Math.pow(e, 6) / 1024) * Math.sin(4 * latRad)
        - (35 * Math.pow(e, 6) / 3072) * Math.sin(6 * latRad)
      );
      var easting = k0 * n * (
        aa + (1 - t + c) * Math.pow(aa, 3) / 6
        + (5 - 18 * t + t * t + 72 * c - 58 * ePrimeSq) * Math.pow(aa, 5) / 120
      ) + 500000;
      var northing = k0 * (
        m + n * Math.tan(latRad) * (
          aa * aa / 2
          + (5 - t + 9 * c + 4 * c * c) * Math.pow(aa, 4) / 24
          + (61 - 58 * t + t * t + 600 * c - 330 * ePrimeSq) * Math.pow(aa, 6) / 720
        )
      );

      if (lat < 0) northing += 10000000;

      return { x: easting, y: northing };
    }

    var metroLabels = window.metroLabels;



    function initMetroLabels(scene) {
      var layer = document.getElementById("citylabels");
      var svg = document.getElementById("label-lines");
      svg.innerHTML = "";

      metroLabels.forEach(function (label) {
        var utm = label.x !== undefined && label.y !== undefined
          ? { x: label.x, y: label.y }
          : lonLatToUtm20s(label.lon, label.lat);
        label.world = scene.toWorldCoordinates({ x: utm.x, y: utm.y, z: 0 });
        label.world.z = 900;

        var node = document.createElement("div");
        node.className = "city-label " + (label.name === "SANTA CRUZ" ? "primary" : "secondary");
        node.textContent = label.name;
        layer.appendChild(node);
        label.node = node;

        label.line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        label.anchorDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        label.labelDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        label.anchorDot.setAttribute("r", "2.6");
        label.labelDot.setAttribute("r", "2.6");
        svg.appendChild(label.line);
        svg.appendChild(label.anchorDot);
        svg.appendChild(label.labelDot);
      });

      updateMetroLabels();
    }

    function projectWorldToScreen(world) {
      var vector = new THREE.Vector3(world.x, world.y, world.z);
      vector.project(app.camera);

      return {
        x: (vector.x * 0.5 + 0.5) * app.width,
        y: (-vector.y * 0.5 + 0.5) * app.height,
        visible: vector.z > -1 && vector.z < 1
      };
    }

    function updateMetroLabels() {
      if (!app.camera || !metroLabels[0].node) return;

      metroLabels.forEach(function (label) {
        var point = projectWorldToScreen(label.world);
        var visible = point.visible
          && point.x > -160 && point.x < app.width + 160
          && point.y > -160 && point.y < app.height + 160;

        label.node.style.display = visible ? "inline-flex" : "none";
        label.line.style.display = visible ? "block" : "none";
        label.anchorDot.style.display = visible ? "block" : "none";
        label.labelDot.style.display = visible ? "block" : "none";

        if (!visible) return;

        var labelX = point.x + label.offset[0];
        var labelY = point.y + label.offset[1];
        var dotY = labelY + 28;
        var labelDotX = point.x;

        label.node.style.left = labelX + "px";
        label.node.style.top = labelY + "px";
        label.line.setAttribute("points", [
          point.x.toFixed(1) + "," + point.y.toFixed(1),
          labelDotX.toFixed(1) + "," + dotY.toFixed(1)
        ].join(" "));
        label.anchorDot.setAttribute("cx", point.x.toFixed(1));
        label.anchorDot.setAttribute("cy", point.y.toFixed(1));
        label.labelDot.setAttribute("cx", labelDotX.toFixed(1));
        label.labelDot.setAttribute("cy", dotY.toFixed(1));
      });
    }

    var originalRender = app.render;
    app.render = function () {
      originalRender.apply(app, arguments);
      updateMetroLabels();
      updateDynamicBasemap();
    };

    var mapLibreCallbacks = [];
    var mapLibreLoading = false;

    function loadMapLibre(callback) {
      if (window.maplibregl) {
        callback();
        return;
      }

      mapLibreCallbacks.push(callback);
      if (mapLibreLoading) return;
      mapLibreLoading = true;

      // TODO: Implement Subresource Integrity (SRI) once the exact locked file version is finalized.
      // SRI hashes should be calculated using the matching version files.

      var stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = "https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css";
      document.head.appendChild(stylesheet);

      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js";
      script.async = true;
      script.onload = function () {
        var callbacks = mapLibreCallbacks.slice();
        mapLibreCallbacks.length = 0;
        callbacks.forEach(function (queuedCallback) {
          queuedCallback();
        });
      };
      script.onerror = function () {
        mapLibreCallbacks.length = 0;
        mapLibreLoading = false;
        var status = document.getElementById("basemapstatus");
        if (status) {
          status.textContent = "Mapa base no disponible. El visor 3D sigue activo.";
          setTimeout(function () {
            status.classList.add("hidden");
          }, 3000);
        }
        markLoadingBasemapReady("MAPA 3D LISTO");
      };
      document.head.appendChild(script);
    }

    var activeBasemapMesh = null;
    var activeBasemapMap = null;
    var dynamicBasemapGroup = null;
    var dynamicBasemapMesh = null;
    var dynamicViewportMesh = null;
    var dynamicBasemapTiles = {};
    var dynamicBasemapLastUpdate = 0;
    var dynamicBasemapLastSignature = "";
    var dynamicBasemapLoadingSignature = "";
    var dynamicViewportSignature = "";
    var dynamicViewportLoadingSignature = "";
    var dynamicTileLoader = null;

    function resetDynamicBasemap() {
      dynamicBasemapLastSignature = "";

      if (dynamicBasemapGroup && app.scene) {
        app.scene.remove(dynamicBasemapGroup);
      }

      if (dynamicBasemapMesh && app.scene) {
        app.scene.remove(dynamicBasemapMesh);
        if (dynamicBasemapMesh.material) {
          if (dynamicBasemapMesh.material.map) dynamicBasemapMesh.material.map.dispose();
          dynamicBasemapMesh.material.dispose();
        }
        if (dynamicBasemapMesh.geometry) dynamicBasemapMesh.geometry.dispose();
      }

      if (dynamicViewportMesh && app.scene) {
        app.scene.remove(dynamicViewportMesh);
        if (dynamicViewportMesh.material) {
          if (dynamicViewportMesh.material.map) dynamicViewportMesh.material.map.dispose();
          dynamicViewportMesh.material.dispose();
        }
        if (dynamicViewportMesh.geometry) dynamicViewportMesh.geometry.dispose();
      }

      Object.keys(dynamicBasemapTiles).forEach(function (key) {
        var tile = dynamicBasemapTiles[key];
        if (tile.mesh) {
          if (tile.mesh.material) {
            if (tile.mesh.material.map) tile.mesh.material.map.dispose();
            tile.mesh.material.dispose();
          }
          if (tile.mesh.geometry) tile.mesh.geometry.dispose();
        }
      });

      dynamicBasemapTiles = {};
      dynamicBasemapGroup = null;
      dynamicBasemapMesh = null;
      dynamicViewportMesh = null;
      dynamicBasemapLoadingSignature = "";
      dynamicViewportSignature = "";
      dynamicViewportLoadingSignature = "";
    }

    function getTileLoader() {
      if (!dynamicTileLoader) {
        dynamicTileLoader = new THREE.TextureLoader();
        if (dynamicTileLoader.setCrossOrigin) dynamicTileLoader.setCrossOrigin("anonymous");
      }

      return dynamicTileLoader;
    }

    function tileUrl(z, x, y) {
      var servers = ["a", "b", "c", "d"];
      var server = servers[Math.abs(x + y) % servers.length];
      var theme = isDarkMode ? "dark_nolabels" : "light_nolabels";
      return "https://" + server + ".basemaps.cartocdn.com/" + theme + "/" + z + "/" + x + "/" + y + ".png";
    }

    function labelTileUrl(z, x, y) {
      var servers = ["a", "b", "c", "d"];
      var server = servers[Math.abs(x + y) % servers.length];
      var theme = isDarkMode ? "dark_only_labels" : "light_only_labels";
      return "https://" + server + ".basemaps.cartocdn.com/" + theme + "/" + z + "/" + x + "/" + y + ".png";
    }

    function satelliteTileUrl(z, x, y) {
      var server = ["mt0", "mt1", "mt2", "mt3"][Math.abs(x + y) % 4];
      return "https://" + server + ".google.com/vt/lyrs=y&x=" + x + "&y=" + y + "&z=" + z;
    }

    function satelliteRoadTileUrl(z, x, y) {
      return "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/" + z + "/" + y + "/" + x;
    }

    function satelliteLabelTileUrl(z, x, y) {
      return "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/" + z + "/" + y + "/" + x;
    }

    function lonLatToTile(lon, lat, z) {
      var n = Math.pow(2, z);
      var latRad = lat * Math.PI / 180;
      var x = Math.floor((lon + 180) / 360 * n);
      var y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);

      return {
        x: Math.max(0, Math.min(n - 1, x)),
        y: Math.max(0, Math.min(n - 1, y))
      };
    }

    function lonLatToTileFloat(lon, lat, z) {
      var n = Math.pow(2, z);
      var latRad = lat * Math.PI / 180;
      return {
        x: (lon + 180) / 360 * n,
        y: (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
      };
    }

    function tileBoundsLonLat(x, y, z) {
      var n = Math.pow(2, z);
      var west = x / n * 360 - 180;
      var east = (x + 1) / n * 360 - 180;
      var north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
      var south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;

      return { west: west, south: south, east: east, north: north };
    }

    function dynamicBasemapZoom(distance) {
      var mobile = window.innerWidth <= 720;
      if (distance > 100000) return 10;
      if (distance > 65000) return 12;
      if (distance > 35000) return 14;
      if (distance > 17000) return mobile ? 15 : 16;
      if (distance > 9000) return mobile ? 16 : 18;
      return mobile ? 18 : 20;
    }

    function fullBasemapBounds() {
      var be = app.scene.userData.baseExtent;
      return {
        west: be.cx - be.width / 2,
        east: be.cx + be.width / 2,
        south: be.cy - be.height / 2,
        north: be.cy + be.height / 2
      };
    }

    function visibleBasemapBounds() {
      var be = app.scene.userData.baseExtent;
      var origin = app.scene.userData.origin;
      var planeZ = -0.64;
      var samples = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0], [0, 0], [1, 0],
        [-1, 1], [0, 1], [1, 1]
      ];
      var raycaster = new THREE.Raycaster();
      var ground = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
      var point = new THREE.Vector3();
      var bounds = {
        west: Infinity,
        east: -Infinity,
        south: Infinity,
        north: -Infinity
      };

      samples.forEach(function (sample) {
        raycaster.setFromCamera(new THREE.Vector2(sample[0], sample[1]), app.camera);
        if (!raycaster.ray.intersectPlane(ground, point)) return;

        var mapX = point.x + origin.x;
        var mapY = point.y + origin.y;
        bounds.west = Math.min(bounds.west, mapX);
        bounds.east = Math.max(bounds.east, mapX);
        bounds.south = Math.min(bounds.south, mapY);
        bounds.north = Math.max(bounds.north, mapY);
      });

      if (!Number.isFinite(bounds.west)) return fullBasemapBounds();

      bounds.west = Math.max(be.cx - be.width / 2, bounds.west);
      bounds.east = Math.min(be.cx + be.width / 2, bounds.east);
      bounds.south = Math.max(be.cy - be.height / 2, bounds.south);
      bounds.north = Math.min(be.cy + be.height / 2, bounds.north);

      return bounds;
    }

    function tilesForBounds(bounds, z) {
      if (bounds.east <= bounds.west || bounds.north <= bounds.south) return [];

      var sw = utm20sToLonLat(bounds.west, bounds.south);
      var ne = utm20sToLonLat(bounds.east, bounds.north);
      var nwTile = lonLatToTile(sw[0], ne[1], z);
      var seTile = lonLatToTile(ne[0], sw[1], z);
      var tiles = [];

      for (var x = nwTile.x; x <= seTile.x; x++) {
        for (var y = nwTile.y; y <= seTile.y; y++) {
          tiles.push({
            x: x,
            y: y,
            z: z,
            key: z + "/" + x + "/" + y + "/" + (isDarkMode ? "dark" : "light")
          });
        }
      }

      return tiles;
    }

    function basemapTileFrame(z) {
      var bounds = fullBasemapBounds();
      var sw = utm20sToLonLat(bounds.west, bounds.south);
      var ne = utm20sToLonLat(bounds.east, bounds.north);
      return {
        west: lonLatToTileFloat(sw[0], 0, z).x,
        east: lonLatToTileFloat(ne[0], 0, z).x,
        north: lonLatToTileFloat(0, ne[1], z).y,
        south: lonLatToTileFloat(0, sw[1], z).y
      };
    }

    function updateDynamicBasemap(force) {
      if (!app.sceneLoaded || !app.scene || !app.camera || !app.controls) return;

      var now = performance.now();
      if (!force && now - dynamicBasemapLastUpdate < 220) return;
      dynamicBasemapLastUpdate = now;

      var target = app.controls.target || new THREE.Vector3();
      var distance = app.camera.position.distanceTo(target);
      var z = dynamicBasemapZoom(distance);
      var mobile = window.innerWidth <= 720;
      var baseZ = Math.min(z, mobile ? 11 : 12);
      var baseBounds = fullBasemapBounds();
      var baseTiles = tilesForBounds(baseBounds, baseZ);

      while (baseTiles.length > (mobile ? 196 : 700) && baseZ > 10) {
        baseZ -= 1;
        baseTiles = tilesForBounds(baseBounds, baseZ);
      }

      var baseSignature = "base|" + baseTiles.map(function (tile) { return tile.key; }).join("|");
      if (force || baseSignature !== dynamicBasemapLastSignature) {
        dynamicBasemapLastSignature = baseSignature;
        loadDynamicBasemapMosaic(baseTiles, baseZ, baseSignature);
      }

      if (z < 13) {
        clearViewportBasemapMosaic();
        return;
      }

      var detailZ = z;
      var detailBounds = visibleBasemapBounds();
      var detailTiles = tilesForBounds(detailBounds, detailZ);
      var maxDetailTiles = mobile ? 64 : 144;

      while (detailTiles.length > maxDetailTiles && detailZ > 13) {
        detailZ -= 1;
        detailTiles = tilesForBounds(detailBounds, detailZ);
      }

      var detailSignature = "viewport|" + detailZ + "|" + detailTiles.map(function (tile) { return tile.key; }).join("|");

      if (force || detailSignature !== dynamicViewportSignature) {
        dynamicViewportSignature = detailSignature;
        loadViewportBasemapMosaic(detailTiles, detailZ, detailBounds, detailSignature);
      }
    }

    function loadTileImage(src) {
      return new Promise(function (resolve) {
        var image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = function () { resolve(image); };
        image.onerror = function () { resolve(null); };
        image.src = src;
      });
    }

    function loadDynamicBasemapMosaic(tiles, z, signature) {
      if (!tiles.length || dynamicBasemapLoadingSignature === signature) return;
      dynamicBasemapLoadingSignature = signature;

      var minX = Infinity;
      var maxX = -Infinity;
      var minY = Infinity;
      var maxY = -Infinity;

      tiles.forEach(function (tile) {
        minX = Math.min(minX, tile.x);
        maxX = Math.max(maxX, tile.x);
        minY = Math.min(minY, tile.y);
        maxY = Math.max(maxY, tile.y);
      });

      var tileSize = 256;
      var cols = maxX - minX + 1;
      var rows = maxY - minY + 1;
      var canvas = document.createElement("canvas");
      canvas.width = cols * tileSize;
      canvas.height = rows * tileSize;
      var ctx = canvas.getContext("2d");

      Promise.all(tiles.map(function (tile) {
        return loadTileImage(tileUrl(tile.z, tile.x, tile.y)).then(function (image) {
          if (!image) return;
          ctx.drawImage(image, (tile.x - minX) * tileSize, (tile.y - minY) * tileSize, tileSize, tileSize);
        });
      })).then(function () {
        if (dynamicBasemapLoadingSignature !== signature || !app.scene) return;

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;

        var be = app.scene.userData.baseExtent;
        var origin = app.scene.userData.origin;
        var gridNorthWest = tileBoundsLonLat(minX, minY, z);
        var gridSouthEast = tileBoundsLonLat(maxX, maxY, z);
        var gridSw = lonLatToUtm20s(gridNorthWest.west, gridSouthEast.south);
        var gridNe = lonLatToUtm20s(gridSouthEast.east, gridNorthWest.north);
        var material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: false,
          depthWrite: false
        });
        var geometry = new THREE.PlaneBufferGeometry(be.width, be.height);
        var uMin = (be.cx - be.width / 2 - gridSw.x) / (gridNe.x - gridSw.x);
        var uMax = (be.cx + be.width / 2 - gridSw.x) / (gridNe.x - gridSw.x);
        var vMin = (be.cy - be.height / 2 - gridSw.y) / (gridNe.y - gridSw.y);
        var vMax = (be.cy + be.height / 2 - gridSw.y) / (gridNe.y - gridSw.y);
        var uv = geometry.attributes.uv;
        uv.setXY(0, uMin, vMax);
        uv.setXY(1, uMax, vMax);
        uv.setXY(2, uMin, vMin);
        uv.setXY(3, uMax, vMin);
        uv.needsUpdate = true;
        var mesh = new THREE.Mesh(geometry, material);

        mesh.name = "Dynamic CARTO basemap mosaic z" + z;
        mesh.position.set(be.cx - origin.x, be.cy - origin.y, -0.66);
        mesh.renderOrder = -998;

        if (dynamicBasemapMesh) {
          app.scene.remove(dynamicBasemapMesh);
          if (dynamicBasemapMesh.material) {
            if (dynamicBasemapMesh.material.map) dynamicBasemapMesh.material.map.dispose();
            dynamicBasemapMesh.material.dispose();
          }
          if (dynamicBasemapMesh.geometry) dynamicBasemapMesh.geometry.dispose();
        }

        dynamicBasemapMesh = mesh;
        app.scene.add(mesh);
        app.render();
      });
    }

    function clearViewportBasemapMosaic() {
      dynamicViewportSignature = "";
      dynamicViewportLoadingSignature = "";

      if (!dynamicViewportMesh || !app.scene) return;

      app.scene.remove(dynamicViewportMesh);
      if (dynamicViewportMesh.material) {
        if (dynamicViewportMesh.material.map) dynamicViewportMesh.material.map.dispose();
        dynamicViewportMesh.material.dispose();
      }
      if (dynamicViewportMesh.geometry) dynamicViewportMesh.geometry.dispose();
      dynamicViewportMesh = null;
      app.render();
    }

    function loadViewportBasemapMosaic(tiles, z, bounds, signature) {
      if (!tiles.length || dynamicViewportLoadingSignature === signature) return;
      dynamicViewportLoadingSignature = signature;

      var minX = Infinity;
      var maxX = -Infinity;
      var minY = Infinity;
      var maxY = -Infinity;

      tiles.forEach(function (tile) {
        minX = Math.min(minX, tile.x);
        maxX = Math.max(maxX, tile.x);
        minY = Math.min(minY, tile.y);
        maxY = Math.max(maxY, tile.y);
      });

      var tileSize = 256;
      var cols = maxX - minX + 1;
      var rows = maxY - minY + 1;
      var canvas = document.createElement("canvas");
      canvas.width = cols * tileSize;
      canvas.height = rows * tileSize;
      var ctx = canvas.getContext("2d");
      var showLabels = satelliteFocusMode || z >= 16;

      Promise.all(tiles.map(function (tile) {
        var baseUrl = satelliteFocusMode
          ? satelliteTileUrl(tile.z, tile.x, tile.y)
          : tileUrl(tile.z, tile.x, tile.y);

        return loadTileImage(baseUrl).then(function (image) {
          if (!image) return;
          ctx.drawImage(image, (tile.x - minX) * tileSize, (tile.y - minY) * tileSize, tileSize, tileSize);
          if (!showLabels) return;

          if (satelliteFocusMode) {
            // Google Hybrid tile (lyrs=y) already contains both high-res satellite imagery and roads/labels.
            // Bypassing secondary requests here saves resource load and yields 3x faster basemap rendering.
            return;
          }

          return loadTileImage(labelTileUrl(tile.z, tile.x, tile.y)).then(function (labelImage) {
            if (!labelImage) return;
            ctx.drawImage(labelImage, (tile.x - minX) * tileSize, (tile.y - minY) * tileSize, tileSize, tileSize);
          });
        });
      })).then(function () {
        if (dynamicViewportLoadingSignature !== signature || !app.scene) return;

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;

        var origin = app.scene.userData.origin;
        var be = app.scene.userData.baseExtent;
        var gridNorthWest = tileBoundsLonLat(minX, minY, z);
        var gridSouthEast = tileBoundsLonLat(maxX, maxY, z);
        var gridSw = lonLatToUtm20s(gridNorthWest.west, gridSouthEast.south);
        var gridNe = lonLatToUtm20s(gridSouthEast.east, gridNorthWest.north);
        var extentWest = be.cx - be.width / 2;
        var extentEast = be.cx + be.width / 2;
        var extentSouth = be.cy - be.height / 2;
        var extentNorth = be.cy + be.height / 2;
        var meshWest = Math.max(gridSw.x, extentWest);
        var meshEast = Math.min(gridNe.x, extentEast);
        var meshSouth = Math.max(gridSw.y, extentSouth);
        var meshNorth = Math.min(gridNe.y, extentNorth);
        var width = meshEast - meshWest;
        var height = meshNorth - meshSouth;

        if (width <= 0 || height <= 0) {
          texture.dispose();
          return;
        }

        var material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.95,
          depthWrite: false
        });
        var geometry = new THREE.PlaneBufferGeometry(width, height);
        var uMin = (meshWest - gridSw.x) / (gridNe.x - gridSw.x);
        var uMax = (meshEast - gridSw.x) / (gridNe.x - gridSw.x);
        var vMin = (meshSouth - gridSw.y) / (gridNe.y - gridSw.y);
        var vMax = (meshNorth - gridSw.y) / (gridNe.y - gridSw.y);
        var uv = geometry.attributes.uv;
        uv.setXY(0, uMin, vMax);
        uv.setXY(1, uMax, vMax);
        uv.setXY(2, uMin, vMin);
        uv.setXY(3, uMax, vMin);
        uv.needsUpdate = true;

        var mesh = new THREE.Mesh(geometry, material);
        mesh.name = "Dynamic CARTO viewport mosaic z" + z;
        mesh.position.set((meshWest + meshEast) / 2 - origin.x, (meshSouth + meshNorth) / 2 - origin.y, -0.64);
        mesh.renderOrder = -997;

        if (dynamicViewportMesh) {
          app.scene.remove(dynamicViewportMesh);
          if (dynamicViewportMesh.material) {
            if (dynamicViewportMesh.material.map) dynamicViewportMesh.material.map.dispose();
            dynamicViewportMesh.material.dispose();
          }
          if (dynamicViewportMesh.geometry) dynamicViewportMesh.geometry.dispose();
        }

        dynamicViewportMesh = mesh;
        app.scene.add(mesh);
        app.render();
      });
    }

    function updateViewportBasemapTiles(tiles) {
      var signature = "detail|" + tiles.map(function (tile) { return tile.key; }).join("|");
      if (signature === dynamicViewportSignature) return;
      dynamicViewportSignature = signature;

      if (!dynamicBasemapGroup) {
        dynamicBasemapGroup = new THREE.Group();
        dynamicBasemapGroup.name = "Dynamic CARTO viewport tiles";
        app.scene.add(dynamicBasemapGroup);
      }

      var wanted = {};
      tiles.forEach(function (tile) {
        wanted[tile.key] = true;
        ensureViewportTile(tile);
      });

      Object.keys(dynamicBasemapTiles).forEach(function (key) {
        var entry = dynamicBasemapTiles[key];
        entry.lastUsed = wanted[key] ? Date.now() : entry.lastUsed;
        if (!entry.mesh) return;

        if (wanted[key]) {
          if (entry.mesh.parent !== dynamicBasemapGroup) dynamicBasemapGroup.add(entry.mesh);
          entry.mesh.visible = true;
        } else {
          entry.mesh.visible = false;
        }
      });

      pruneViewportTileCache();
      app.render();
    }

    function ensureViewportTile(tile) {
      var cached = dynamicBasemapTiles[tile.key];
      if (cached) {
        cached.lastUsed = Date.now();
        if (cached.mesh) {
          cached.mesh.visible = true;
          if (cached.mesh.parent !== dynamicBasemapGroup) dynamicBasemapGroup.add(cached.mesh);
        }
        return;
      }

      dynamicBasemapTiles[tile.key] = {
        loading: true,
        lastUsed: Date.now()
      };

      loadTileImage(tileUrl(tile.z, tile.x, tile.y)).then(function (image) {
        var entry = dynamicBasemapTiles[tile.key];
        if (!entry || !app.scene) {
          return;
        }

        if (!image || isBlankCartoTile(image)) {
          delete dynamicBasemapTiles[tile.key];
          return;
        }

        var texture = new THREE.Texture(image);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 1;
        texture.needsUpdate = true;

        var mesh = createViewportTileMesh(tile, texture);
        if (!mesh) {
          texture.dispose();
          delete dynamicBasemapTiles[tile.key];
          return;
        }

        entry.loading = false;
        entry.texture = texture;
        entry.mesh = mesh;
        entry.lastUsed = Date.now();

        if (dynamicBasemapGroup && dynamicViewportSignature.indexOf(tile.key) !== -1) {
          dynamicBasemapGroup.add(mesh);
          mesh.visible = true;
        } else {
          mesh.visible = false;
        }

        app.render();
      });
    }

    function isBlankCartoTile(image) {
      var canvas = document.createElement("canvas");
      var size = 64;
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, size, size);

      var data;
      try {
        data = ctx.getImageData(0, 0, size, size).data;
      } catch (error) {
        return false;
      }

      var sum = 0;
      var sumSq = 0;
      var count = 0;

      for (var i = 0; i < data.length; i += 16) {
        var value = (data[i] + data[i + 1] + data[i + 2]) / 3;
        sum += value;
        sumSq += value * value;
        count += 1;
      }

      var mean = sum / count;
      var variance = Math.max(0, sumSq / count - mean * mean);
      var deviation = Math.sqrt(variance);

      return mean > 248 && deviation < 5;
    }

    function createViewportTileMesh(tile, texture) {
      var origin = app.scene.userData.origin;
      var be = app.scene.userData.baseExtent;
      var frame = basemapTileFrame(tile.z);
      var frameWidth = frame.east - frame.west;
      var frameHeight = frame.south - frame.north;

      if (frameWidth <= 0 || frameHeight <= 0) return null;

      var extentWest = be.cx - be.width / 2;
      var extentEast = be.cx + be.width / 2;
      var extentSouth = be.cy - be.height / 2;
      var extentNorth = be.cy + be.height / 2;
      var tileWest = extentWest + ((tile.x - frame.west) / frameWidth) * be.width;
      var tileEast = extentWest + (((tile.x + 1) - frame.west) / frameWidth) * be.width;
      var tileNorth = extentNorth - ((tile.y - frame.north) / frameHeight) * be.height;
      var tileSouth = extentNorth - (((tile.y + 1) - frame.north) / frameHeight) * be.height;
      var clipWest = Math.max(tileWest, extentWest);
      var clipEast = Math.min(tileEast, extentEast);
      var clipSouth = Math.max(tileSouth, extentSouth);
      var clipNorth = Math.min(tileNorth, extentNorth);

      if (clipEast <= clipWest || clipNorth <= clipSouth) return null;

      var geometry = new THREE.PlaneBufferGeometry(clipEast - clipWest, clipNorth - clipSouth);
      var uMin = (clipWest - tileWest) / (tileEast - tileWest);
      var uMax = (clipEast - tileWest) / (tileEast - tileWest);
      var vMin = (clipSouth - tileSouth) / (tileNorth - tileSouth);
      var vMax = (clipNorth - tileSouth) / (tileNorth - tileSouth);
      var uv = geometry.attributes.uv;
      uv.setXY(0, uMin, vMax);
      uv.setXY(1, uMax, vMax);
      uv.setXY(2, uMin, vMin);
      uv.setXY(3, uMax, vMin);
      uv.needsUpdate = true;

      var material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.82,
        depthWrite: false
      });
      var mesh = new THREE.Mesh(geometry, material);
      mesh.name = "CARTO viewport tile " + tile.key;
      mesh.position.set((clipWest + clipEast) / 2 - origin.x, (clipSouth + clipNorth) / 2 - origin.y, -0.64);
      mesh.renderOrder = -997;
      return mesh;
    }

    function pruneViewportTileCache() {
      var maxCache = window.innerWidth <= 720 ? 160 : 320;
      var entries = Object.keys(dynamicBasemapTiles).map(function (key) {
        return { key: key, entry: dynamicBasemapTiles[key] };
      }).filter(function (item) {
        return !item.entry.loading && (!item.entry.mesh || !item.entry.mesh.visible);
      });

      if (Object.keys(dynamicBasemapTiles).length <= maxCache) return;

      entries.sort(function (a, b) {
        return (a.entry.lastUsed || 0) - (b.entry.lastUsed || 0);
      });

      while (Object.keys(dynamicBasemapTiles).length > maxCache && entries.length) {
        var item = entries.shift();
        var entry = dynamicBasemapTiles[item.key];
        if (!entry || (entry.mesh && entry.mesh.visible)) continue;

        if (entry.mesh) {
          if (entry.mesh.parent) entry.mesh.parent.remove(entry.mesh);
          if (entry.mesh.material) {
            if (entry.mesh.material.map) entry.mesh.material.map.dispose();
            entry.mesh.material.dispose();
          }
          if (entry.mesh.geometry) entry.mesh.geometry.dispose();
        } else if (entry.texture) {
          entry.texture.dispose();
        }

        delete dynamicBasemapTiles[item.key];
      }
    }

    function addBasemap(scene, styleSource, meshName, options) {
      options = options || {};
      var status = document.getElementById("basemapstatus");
      status.classList.remove("hidden");
      status.textContent = "Cargando mapa base...";

      if (!window.maplibregl) {
        loadMapLibre(function () {
          addBasemap(scene, styleSource, meshName, options);
        });
        return;
      }

      if (activeBasemapMesh) {
        scene.remove(activeBasemapMesh);
        activeBasemapMesh = null;
      }
      resetDynamicBasemap();
      if (activeBasemapMap) {
        activeBasemapMap.remove();
        activeBasemapMap = null;
      }

      var be = scene.userData.baseExtent;
      var origin = scene.userData.origin;
      var west = be.cx - be.width / 2;
      var east = be.cx + be.width / 2;
      var south = be.cy - be.height / 2;
      var north = be.cy + be.height / 2;
      var sw = utm20sToLonLat(west, south);
      var ne = utm20sToLonLat(east, north);

      var oldMapNode = document.getElementById("cartobasemap");
      if (oldMapNode) oldMapNode.remove();

      var mapNode = document.createElement("div");
      mapNode.id = "cartobasemap";
      mapNode.style.position = "absolute";
      mapNode.style.left = "-1200px";
      mapNode.style.top = "0";
      mapNode.style.width = "1024px";
      mapNode.style.height = "1024px";
      mapNode.style.pointerEvents = "none";
      mapNode.style.opacity = "0";
      document.getElementById("view").appendChild(mapNode);

      var stylePromise = typeof styleSource === "string"
        ? fetch(styleSource).then(function (response) {
            if (!response.ok) throw new Error("No se pudo cargar el estilo");
            return response.json();
          })
        : Promise.resolve(styleSource);

      stylePromise
        .then(function (style) {
          if (!options.keepLabels && Array.isArray(style.layers)) {
            style.layers = style.layers.filter(function (layer) {
              return layer.type !== "symbol";
            });
          }

          var map = new maplibregl.Map({
            container: mapNode,
            style: style,
            bounds: [sw, ne],
            fitBoundsOptions: { padding: 0 },
            interactive: false,
            attributionControl: false,
            preserveDrawingBuffer: true
          });

          activeBasemapMap = map;

          map.once("idle", function () {
            var texture = new THREE.CanvasTexture(map.getCanvas());
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.needsUpdate = true;

            var geometry = new THREE.PlaneBufferGeometry(be.width, be.height);
            var material = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: false,
              depthWrite: false
            });
            var mesh = new THREE.Mesh(geometry, material);

            mesh.name = meshName;
            mesh.position.set(be.cx - origin.x, be.cy - origin.y, -0.75);
            mesh.renderOrder = -1000;
            scene.add(mesh);
            scene.updateMatrixWorld();

            activeBasemapMesh = mesh;
            app.render();
            updateDynamicBasemap(true);

            status.textContent = "Mapa base cargado";
            markLoadingBasemapReady("MAPA BASE CARGADO");
            setTimeout(function () {
              status.classList.add("hidden");
            }, 1200);
          });

          map.on("error", function () {
            status.textContent = "Error de carga de mapa base";
            markLoadingBasemapReady("MAPA 3D LISTO");
          });
        })
        .catch(function () {
          status.textContent = "Error al conectar con el servidor de mapas base";
          markLoadingBasemapReady("MAPA 3D LISTO");
        });
    }

    // load the scene
    app.loadSceneFile("./data/index/scene.json", function (scene) {
      // scene file has been loaded
      initMetroLabels(scene);
      app.start();
      createLayerControls();
      applyActiveLayer();
      applyPopulationThreshold();
    }, function (scene) {
      setTimeout(function () {
        loadActiveBasemap();
      }, 0);
    });
