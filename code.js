// This plugin organises the selected component set into a tidy grid.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
// The 'input' event listens for text change in the Quick Actions box after a plugin is 'Tabbed' into.
figma.parameters.on("input", ({ query, parameters, result }) => {
    const selection = getFilteredSelection();
    if (selection.length !== 1) {
        result.setError("⚠️ Select a single component set first");
        return;
    }
    const componentSet = selection[0];
    let variantProps;
    try {
        variantProps = componentSet.variantGroupProperties;
    }
    catch (error) {
        result.setError("⚠️ Resolve conflicting variants in order to continue");
        return;
    }
    const propsList = Object.keys(variantProps);
    if (propsList.length < 2) {
        result.setError("⚠️ The component must have more than one property");
        return;
    }
    const suggestions = propsList.filter((item) => item.toLowerCase().includes(query.toLowerCase()) &&
        item !== parameters["column"] &&
        item !== parameters["row"]);
    result.setSuggestions(suggestions);
});
// When the user presses Enter after inputting all parameters, the 'run' event is fired.
figma.on("run", ({ parameters }) => __awaiter(this, void 0, void 0, function* () {
    yield loadFonts();
    if (parameters) {
        yield startPluginWithParameters(parameters);
    }
}));
function startPluginWithParameters(parameters) {
    const selection = getFilteredSelection();
    if (selection.length !== 1) {
        figma.notify("⚠️ Select a single component set first");
        figma.closePlugin();
        return;
    }
    // Get variants and variant properties from selected Component Set
    const componentSet = selection[0];
    const variants = componentSet.children;
    let variantProps;
    try {
        variantProps = componentSet.variantGroupProperties;
    }
    catch (error) {
        figma.notify("⚠️ Resolve conflicting variants in order to continue");
        figma.closePlugin();
        return;
    }
    // Check parameters match component properties
    const match = Object.values(parameters).every((value) => Object.keys(variantProps).includes(value));
    if (!match) {
        figma.notify("⚠️ Chosen properties don't match component properties");
        figma.closePlugin();
        return;
    }
    // Set defaults for grid spacing
    const spacing_subGrid = 24;
    const spacing_groups = 96;
    // Determine columns and rows in both sub-grid and horizontal groups
    const columnProps_subGrid = variantProps[parameters["column"]].values;
    const rowProps_subGrid = variantProps[parameters["row"]].values;
    const columnProps_group = parameters["hGroup"] && variantProps[parameters["hGroup"]].values;
    // Calculate grid sizing based on largest variant sizes (rounded up to sit on 8px grid)
    const maxWidth = Math.ceil(Math.max(...variants.map((element) => element.width)) / 8) * 8;
    const maxHeight = Math.ceil(Math.max(...variants.map((element) => element.height)) / 8) *
        8;
    const columnCount_subGrid = columnProps_subGrid.length;
    const rowCount_subGrid = rowProps_subGrid.length;
    const dx_subGrid = maxWidth + spacing_subGrid;
    const dy_subGrid = maxHeight + spacing_subGrid;
    const dx_group = dx_subGrid * columnCount_subGrid - spacing_subGrid + spacing_groups;
    const dy_group = dy_subGrid * rowCount_subGrid - spacing_subGrid + spacing_groups;
    // Seperate out properties used for vetical grouping
    function getGroupProps(variant) {
        const props = variant.variantProperties;
        const _a = props, _b = parameters["column"], columnProp = _a[_b], _c = parameters["row"], rowProp = _a[_c], groupProps = __rest(_a, [typeof _b === "symbol" ? _b : _b + "", typeof _c === "symbol" ? _c : _c + ""]);
        if (parameters["hGroup"]) {
            delete groupProps[parameters["hGroup"]];
        }
        return groupProps;
    }
    const groupPropsList = variants.map((variant) => getGroupProps(variant));
    // Calculate group numbers and sort according to order of props and values in Component Set
    function getPropIdentifier([key, value]) {
        const keyIndex = getPaddedIndex(key, Object.keys(variantProps));
        const valueIndex = getPaddedIndex(value, variantProps[key].values);
        return `${keyIndex}${valueIndex}`;
    }
    function getObjectIdentifier(json) {
        const obj = JSON.parse(json);
        return Object.entries(obj)
            .map((prop) => getPropIdentifier(prop))
            .sort()
            .toString();
    }
    const uniqueGroups = [
        ...new Map(groupPropsList.map((obj) => [JSON.stringify(obj), obj])).keys(),
    ].sort((a, b) => {
        const idA = getObjectIdentifier(a);
        const idB = getObjectIdentifier(b);
        if (idA < idB) {
            return -1;
        }
        if (idA > idB) {
            return 1;
        }
        // identifiers must be equal
        return 0;
    });
    // Layout variants in grid
    variants.forEach((variant) => {
        const props = variant.variantProperties;
        const columnIndex_subGrid = columnProps_subGrid.indexOf(props[parameters["column"]]);
        const rowIndex_subGrid = rowProps_subGrid.indexOf(props[parameters["row"]]);
        const columnIndex_group = parameters["hGroup"]
            ? columnProps_group.indexOf(props[parameters["hGroup"]])
            : 0;
        const rowIndex_group = uniqueGroups.indexOf(JSON.stringify(getGroupProps(variant)));
        variant.x =
            columnIndex_subGrid * dx_subGrid +
                columnIndex_group * dx_group +
                spacing_subGrid;
        variant.y =
            rowIndex_subGrid * dy_subGrid +
                rowIndex_group * dy_group +
                spacing_subGrid;
    });
    // Resize Component Set
    componentSet.layoutMode = "NONE";
    const bottomRigthX = Math.max(...variants.map((child) => child.x + child.width));
    const bottomRigthY = Math.max(...variants.map((child) => child.y + child.height));
    componentSet.resizeWithoutConstraints(bottomRigthX + spacing_subGrid, bottomRigthY + spacing_subGrid);
    // Create frame to contain labels and match its size & position to component set
    const componentSetIndex = componentSet.parent.children.indexOf(componentSet);
    const labelsParentFrame = figma.createFrame();
    componentSet.parent.insertChild(componentSetIndex, labelsParentFrame);
    labelsParentFrame.x = componentSet.x;
    labelsParentFrame.y = componentSet.y;
    labelsParentFrame.resize(componentSet.width, componentSet.height);
    labelsParentFrame.fills = [];
    labelsParentFrame.name = `${componentSet.name} - property labels`;
    labelsParentFrame.expanded = false;
    labelsParentFrame.clipsContent = false;
    // Add labels
    const labels_rowGroups = [];
    const labels_subGridRows = [];
    function createSubGridColumnLabels(groupIndex) {
        columnProps_subGrid.forEach((prop, i) => {
            const label = createText(prop);
            labelsParentFrame.appendChild(label);
            label.x = dx_subGrid * i + dx_group * groupIndex + spacing_subGrid;
            label.y = -spacing_subGrid * 2;
        });
    }
    function createSubGridRowLabels(groupIndex) {
        rowProps_subGrid.forEach((prop, i) => {
            const label = createText(prop);
            labelsParentFrame.appendChild(label);
            labels_subGridRows.push(label);
            label.y =
                dy_subGrid * i + dy_group * groupIndex + spacing_subGrid;
        });
    }
    // Generate column labels
    if (columnProps_group) {
        columnProps_group.forEach((prop, i) => {
            const label = createText(prop, 20, "Bold");
            labelsParentFrame.appendChild(label);
            label.x = dx_group * i + spacing_subGrid;
            label.y = -spacing_groups - spacing_subGrid * 2;
            createSubGridColumnLabels(i);
        });
    }
    else {
        createSubGridColumnLabels(0);
    }
    // Generate row labels
    if (uniqueGroups.length > 1) {
        uniqueGroups.forEach((json, i) => {
            const obj = JSON.parse(json);
            const characters = Object.values(obj).toString();
            const label = createText(characters, 20, "Bold");
            labelsParentFrame.appendChild(label);
            label.y = dy_group * i + spacing_subGrid;
            labels_rowGroups.push(label);
            createSubGridRowLabels(i);
        });
    }
    else {
        createSubGridRowLabels(0);
    }
    // Calculate offsets for row labels
    const labelMaxWidth_rowGroups = Math.max(...labels_rowGroups.map((element) => element.width));
    const labelMaxWidth_subGridRows = Math.max(...labels_subGridRows.map((element) => element.width));
    // Offset row labels to left of component set
    labels_rowGroups.forEach((label) => {
        label.x =
            label.x -
                labelMaxWidth_rowGroups -
                labelMaxWidth_subGridRows -
                spacing_subGrid -
                spacing_groups;
    });
    labels_subGridRows.forEach((label) => {
        label.x = label.x - labelMaxWidth_subGridRows - spacing_subGrid;
    });
    // Make sure to close the plugin when you're done. Otherwise the plugin will
    // keep running, which shows the cancel button at the bottom of the screen.
    figma.closePlugin();
}
function getFilteredSelection() {
    return figma.currentPage.selection.filter((node) => node.type === "COMPONENT_SET");
}
function zeroPaddedNumber(num, max) {
    const countLength = max.toString().length;
    return num.toString().padStart(countLength, "0");
}
function getPaddedIndex(item, arr) {
    return zeroPaddedNumber(arr.indexOf(item), arr.length);
}
function loadFonts() {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            figma.loadFontAsync({ family: "Space Mono", style: "Regular" }),
            figma.loadFontAsync({ family: "Space Mono", style: "Bold" }),
        ]);
    });
}
function createText(characters, size = 16, style = "Regular") {
    const text = figma.createText();
    text.fontName = { family: "Space Mono", style: style };
    text.characters = characters;
    text.fontSize = size;
    text.fills = [
        {
            type: "SOLID",
            color: { r: 123 / 255, g: 97 / 255, b: 255 / 255 },
        },
    ];
    return text;
}
