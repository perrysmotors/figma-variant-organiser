// This plugin organises the selected component set into a tidy grid.

// The 'input' event listens for text change in the Quick Actions box after a plugin is 'Tabbed' into.
figma.parameters.on(
    "input",
    ({ key, query, parameters, result }: ParameterInputEvent) => {
        let suggestions
        switch (key) {
            case "row":
            case "column":
            case "hGroup":
                const selection = getFilteredSelection()

                if (selection.length !== 1) {
                    result.setError("⚠️ Select a single component set first")
                    return
                }

                const componentSet = selection[0] as ComponentSetNode

                let variantGroupProperties
                try {
                    variantGroupProperties = componentSet.variantGroupProperties
                } catch (error) {
                    result.setError(
                        "⚠️ Resolve conflicting variants in order to continue"
                    )
                    return
                }

                const propNames = Object.keys(variantGroupProperties)

                if (propNames.length < 2) {
                    result.setError(
                        "⚠️ The component must have more than one property"
                    )
                    return
                }

                suggestions = propNames.filter(
                    (item) =>
                        item.toLowerCase().includes(query.toLowerCase()) &&
                        item !== parameters["column"] &&
                        item !== parameters["row"]
                )
                break

            case "spacing_subGrid":
            case "spacing_groups":
                const defaults =
                    key === "spacing_subGrid"
                        ? ["8", "16", "24", "32", "40"]
                        : ["96", "192", "288", "384", "480"]

                // Check the input is valid
                const number = Number(query)
                if (!Number.isInteger(number) || number < 0) {
                    result.setError("⚠️ Try entering a positive number")
                    return
                }

                suggestions = (
                    query === "" || defaults.includes(query)
                        ? defaults
                        : [query, ...defaults]
                ) // default values plus the typed value
                    .filter((s) => s.includes(query)) // just values matching the typed value
                    .map((value) => ({ name: value, data: Number(value) })) // include the numerical value with the suggestions
                break

            default:
                return
        }
        result.setSuggestions(suggestions)
    }
)

// When the user presses Enter after inputting all parameters, the 'run' event is fired.
figma.on("run", async ({ command, parameters }: RunEvent) => {
    let closeMessage = ""
    if (command === "organise") {
        await loadFonts()
        const spacing = await getSpacing()
        const errorMessage = organise(parameters, spacing)
        if (errorMessage) {
            figma.notify(errorMessage, { error: true })
        } else {
            closeMessage = "Done"
        }
    } else {
        await figma.clientStorage.setAsync("spacing", {
            subGrid: parameters["spacing_subGrid"],
            groups: parameters["spacing_groups"],
        })
        closeMessage = "Preferences updated"
    }
    figma.closePlugin(closeMessage)
})

function organise(parameters: ParameterValues, spacing): string {
    const selection = getFilteredSelection()
    if (selection.length !== 1) return "⚠️ Select a single component set first"

    // Get variants and variant properties from selected Component Set
    const componentSet = selection[0] as ComponentSetNode
    const variants = componentSet.children

    let variantGroupProperties
    try {
        variantGroupProperties = componentSet.variantGroupProperties
    } catch (error) {
        return "⚠️ Resolve conflicting variants in order to continue"
    }

    // Check parameters match component properties
    const match = Object.values(parameters).every((value) =>
        Object.keys(variantGroupProperties).includes(value)
    )
    if (!match) {
        return "⚠️ Chosen properties don't match component properties"
    }

    // Determine columns and rows in both sub-grid and horizontal groups
    const columnPropValues_subGrid =
        variantGroupProperties[parameters["column"]].values
    const rowPropValues_subGrid =
        variantGroupProperties[parameters["row"]].values
    const columnPropValues_group =
        parameters["hGroup"] &&
        variantGroupProperties[parameters["hGroup"]].values

    // Calculate grid sizing based on largest variant sizes (rounded up to sit on 8px grid)
    const maxWidth =
        Math.ceil(Math.max(...variants.map((element) => element.width)) / 8) * 8
    const maxHeight =
        Math.ceil(Math.max(...variants.map((element) => element.height)) / 8) *
        8

    const dx_subGrid = maxWidth + spacing.subGrid
    const dy_subGrid = maxHeight + spacing.subGrid
    const dx_group =
        dx_subGrid * columnPropValues_subGrid.length -
        spacing.subGrid +
        spacing.groups
    const dy_group =
        dy_subGrid * rowPropValues_subGrid.length -
        spacing.subGrid +
        spacing.groups

    // Seperate out properties used for vertical grouping
    function getGroupProps(variant: ComponentNode) {
        const props = variant.variantProperties

        const {
            [parameters["column"]]: columnProp,
            [parameters["row"]]: rowProp,
            ...groupProps
        } = props

        if (parameters["hGroup"]) {
            delete groupProps[parameters["hGroup"]]
        }
        return groupProps
    }

    const groupPropsOfEveryVariant = variants.map((variant: ComponentNode) =>
        getGroupProps(variant)
    )

    // Calculate group numbers and sort according to order of props and values in Component Set
    function getPropIdentifier([key, value]) {
        const keyIndex = getPaddedIndex(
            key,
            Object.keys(variantGroupProperties)
        )
        const valueIndex = getPaddedIndex(
            value,
            variantGroupProperties[key].values
        )
        return `${keyIndex}${valueIndex}`
    }

    function getObjectIdentifier(json) {
        const obj = JSON.parse(json)
        return Object.entries(obj)
            .map((prop) => getPropIdentifier(prop))
            .sort()
            .toString()
    }

    const uniqueGroups = [
        ...new Map(
            groupPropsOfEveryVariant.map((obj) => [JSON.stringify(obj), obj])
        ).keys(),
    ].sort((a, b) => {
        const idA = getObjectIdentifier(a)
        const idB = getObjectIdentifier(b)

        if (idA < idB) {
            return -1
        }
        if (idA > idB) {
            return 1
        }

        // identifiers must be equal
        return 0
    })

    // Layout variants in grid
    variants.forEach((variant: ComponentNode) => {
        const props = variant.variantProperties

        const columnIndex_subGrid = columnPropValues_subGrid.indexOf(
            props[parameters["column"]]
        )
        const rowIndex_subGrid = rowPropValues_subGrid.indexOf(
            props[parameters["row"]]
        )
        const columnIndex_group = parameters["hGroup"]
            ? columnPropValues_group.indexOf(props[parameters["hGroup"]])
            : 0
        const rowIndex_group = uniqueGroups.indexOf(
            JSON.stringify(getGroupProps(variant))
        )

        variant.x =
            columnIndex_subGrid * dx_subGrid +
            columnIndex_group * dx_group +
            spacing.subGrid
        variant.y =
            rowIndex_subGrid * dy_subGrid +
            rowIndex_group * dy_group +
            spacing.subGrid
    })

    // Resize Component Set
    componentSet.layoutMode = "NONE"

    const bottomRigthX = Math.max(
        ...variants.map((child) => child.x + child.width)
    )
    const bottomRigthY = Math.max(
        ...variants.map((child) => child.y + child.height)
    )

    componentSet.resizeWithoutConstraints(
        bottomRigthX + spacing.subGrid,
        bottomRigthY + spacing.subGrid
    )

    // Create frame to contain labels and match its size & position to component set
    const componentSetIndex = componentSet.parent.children.indexOf(componentSet)
    const labelsParentFrame = figma.createFrame()
    componentSet.parent.insertChild(componentSetIndex, labelsParentFrame)

    labelsParentFrame.x = componentSet.x
    labelsParentFrame.y = componentSet.y
    labelsParentFrame.resize(componentSet.width, componentSet.height)
    labelsParentFrame.fills = []
    labelsParentFrame.name = `${componentSet.name} - property labels`
    labelsParentFrame.expanded = false
    labelsParentFrame.clipsContent = false

    // Add labels
    const labels_rowGroups = []
    const labels_subGridRows = []

    // Get list of boolean properties
    const booleanPropNames = Object.entries(variantGroupProperties)
        .filter((arr) => {
            const values = arr[1]["values"]
                .map((value) => value.toLowerCase())
                .sort()
            if (values.length !== 2) return false
            return (
                (values[0] === "off" && values[1] === "on") ||
                (values[0] === "false" && values[1] === "true")
            )
        })
        .map((arr) => arr[0])

    // Include property names with boolean values to make labels clearer
    function getLabelText(key, value) {
        return booleanPropNames.includes(key) ? `${key}=${value}` : value
    }

    function createSubGridColumnLabels(groupIndex) {
        columnPropValues_subGrid.forEach((value, i) => {
            const label = createText(getLabelText(parameters["column"], value))
            labelsParentFrame.appendChild(label)
            label.x = dx_subGrid * i + dx_group * groupIndex + spacing.subGrid
            label.y = -spacing.subGrid - label.height
        })
    }

    function createSubGridRowLabels(groupIndex) {
        rowPropValues_subGrid.forEach((value, i) => {
            const label = createText(getLabelText(parameters["row"], value))
            labelsParentFrame.appendChild(label)
            labels_subGridRows.push(label)
            label.y = dy_subGrid * i + dy_group * groupIndex + spacing.subGrid
        })
    }

    // Generate column labels
    if (columnPropValues_group) {
        columnPropValues_group.forEach((value, i) => {
            const label = createText(
                getLabelText(parameters["hGroup"], value),
                20,
                "Bold"
            )
            labelsParentFrame.appendChild(label)
            label.x = dx_group * i + spacing.subGrid
            label.y = -spacing.groups - spacing.subGrid - label.height - 24 // allow 24 for height of sub-grid labels
            createSubGridColumnLabels(i)
        })
    } else {
        createSubGridColumnLabels(0)
    }

    // Generate row labels
    if (uniqueGroups.length > 1) {
        uniqueGroups.forEach((json, i) => {
            const labelText = Object.entries(JSON.parse(json))
                .map(([key, value]) => getLabelText(key, value))
                .join(", ")
            const label = createText(labelText, 20, "Bold")
            labelsParentFrame.appendChild(label)
            label.y = dy_group * i + spacing.subGrid
            labels_rowGroups.push(label)
            createSubGridRowLabels(i)
        })
    } else {
        createSubGridRowLabels(0)
    }

    // Calculate offsets for row labels
    const labelMaxWidth_rowGroups = Math.max(
        ...labels_rowGroups.map((element) => element.width)
    )
    const labelMaxWidth_subGridRows = Math.max(
        ...labels_subGridRows.map((element) => element.width)
    )

    // Offset row labels to left of component set
    labels_rowGroups.forEach((label) => {
        label.x =
            label.x -
            labelMaxWidth_rowGroups -
            labelMaxWidth_subGridRows -
            spacing.subGrid -
            spacing.groups
    })
    labels_subGridRows.forEach((label) => {
        label.x = label.x - labelMaxWidth_subGridRows - spacing.subGrid
    })
}

function getFilteredSelection() {
    return figma.currentPage.selection.filter(
        (node) => node.type === "COMPONENT_SET"
    )
}

function zeroPaddedNumber(num, max) {
    const countLength = max.toString().length
    return num.toString().padStart(countLength, "0")
}

function getPaddedIndex(item, arr) {
    return zeroPaddedNumber(arr.indexOf(item), arr.length)
}

async function loadFonts() {
    await Promise.all([
        figma.loadFontAsync({ family: "Space Mono", style: "Regular" }),
        figma.loadFontAsync({ family: "Space Mono", style: "Bold" }),
    ])
}

function createText(
    characters: string,
    size: number = 16,
    style: string = "Regular"
) {
    const text = figma.createText()
    text.fontName = { family: "Space Mono", style: style }
    text.characters = characters
    text.fontSize = size
    text.fills = [
        {
            type: "SOLID",
            color: { r: 123 / 255, g: 97 / 255, b: 255 / 255 },
        },
    ]
    return text
}

async function getSpacing() {
    const spacing = await figma.clientStorage.getAsync("spacing")
    if (spacing === undefined) return { subGrid: 24, groups: 96 }
    return spacing
}
