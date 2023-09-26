# Variant Organiser

**Keep your variants tidy with Variant Organiser**

Variant Organiser automatically arranges variants in a grid and creates property labels.

**NEW IN THIS VERSION – Automatic Mode**

## How to use Variant Organiser

Variant Organiser is keyboard operated from Figma’s quick actions search bar:

**→** Type `⌘` + `/` to open Figma’s quick actions search bar (or `CTRL` + `/` if you are on Windows)

**→** Start typing “Variant Organiser” to search for the plugin

## Using the 'Manual' command

**'Manual'** is the new name for the 'Organise' command you know and love. Use it when you want control over the logic for ordering variants. 'Manual' mode is only available for component sets with **two or more variant properties**.

**→** First select the component set you want to organise

**→** Search for and select `Variant Organiser > Manual` in Figma’s quick actions search bar

**→** Follow the prompts:

1. Select which property to use for **columns** in the primary grid.
2. Select which property to use for **rows** in the primary grid. If your component only has two properties, that's sufficient to arrange the variants in a simple grid. If you have more properties, this grid will be repeated to form blocks of variants within a larger grid.
3. Hit `Tab` to if you want to chose a property to generate **horizontal blocks**. This step is optional.
4. Hit `Enter` to generate the full grid structure. Any remaining properties will be used to group variants vertically.

## Using the 'Automatic' command

The **'Automatic'** command organises variants automatically, without asking you to enter any parameters. Variants are organised based on the order that variant properties appear in Figma's right sidebar. 'Automatic' mode works on component sets with any number of variant properties. **Use 'Automatic' mode when your component set only has one variant property.**

## How to edit spacing preferences

You can edit the _spacing between variants_, as well as the _block spacing_ in `Preferences`.

**→** Search for and select `Variant Organiser > Preferences` in Figma’s quick actions search bar

**→** Follow the prompts:

1. Enter the `Variant spacing`
2. Enter the `Block spacing`
3. Hit `Enter` to save your preferences
