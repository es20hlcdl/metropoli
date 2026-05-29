html_path = r"d:\01_Paginas_web\Metropoli\js\app.js"

with open(html_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix clearColumnIsolation by removing applyUrbanFilter()
old_clear = """    function clearColumnIsolation(renderNow) {
      setIsolatedColumnVisible(true);
      isolatedColumnObject = null;
      isolateSelectionActive = false;
      syncIsolationControls();
      clearColumnFootprint();

      if (renderNow === false) return;
      applyPopulationThreshold();
      applyUrbanFilter();
    }"""

new_clear = """    function clearColumnIsolation(renderNow) {
      setIsolatedColumnVisible(true);
      isolatedColumnObject = null;
      isolateSelectionActive = false;
      syncIsolationControls();
      clearColumnFootprint();

      if (renderNow === false) return;
      applyPopulationThreshold();
    }"""

if old_clear in content:
    content = content.replace(old_clear, new_clear)
    print("clearColumnIsolation successfully patched!")
else:
    print("Error: clearColumnIsolation target not found!")

# 2. Fix showQueryResult by removing compareModeActive references
old_query = """    gui.showQueryResult = function (point, layer, obj) {
      if (layer && layer.id === populationLayerId) {
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
    };"""

new_query = """    gui.showQueryResult = function (point, layer, obj) {
      if (layer && layer.id === populationLayerId) {
        if (isolateSelectionActive) {
          isolateColumn(obj);
        }

        if (satelliteFocusMode) {
          // Automatically focus, outline, and isolate the new clicked cell when in 2D satellite focus mode
          showColumnIn2D(obj);
        }
        updateStatsPanel(layer, obj);
        showPopulationPopup(layer, obj);
      }
      else {
        closeStatsPanel();
        clearPopulationPopupState();
        gui.popup.hide();
      }
    };"""

if old_query in content:
    content = content.replace(old_query, new_query)
    print("showQueryResult successfully patched!")
else:
    print("Error: showQueryResult target not found!")

# 3. Add population-context__primary-action class to view2DButton in showPopulationPopup
old_btn = """        view2DButton.type = "button";
        view2DButton.textContent = "Ver en 2D";"""

new_btn = """        view2DButton.type = "button";
        view2DButton.className = "population-context__primary-action";
        view2DButton.textContent = "Ver en 2D";"""

if old_btn in content:
    content = content.replace(old_btn, new_btn)
    print("view2DButton class successfully added!")
else:
    print("Error: view2DButton target not found!")

with open(html_path, "w", encoding="utf-8") as f:
    f.write(content)
print("js/app.js successfully saved!")
