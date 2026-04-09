const initVariables = (instance) => {
	let variables = []

	// Channel name variables — one per channel across all mute-scoped types
	const addNameVariables = (choices) => {
		for (const item of choices) {
			variables.push({
				variableId: `name_${item.id}`,
				name: `${item.label} Name`,
			})
		}
	}

	// Fader level variables — one per channel across all fader-scoped types
	const addLevelVariables = (choices) => {
		for (const item of choices) {
			variables.push({
				variableId: `level_${item.id}`,
				name: `${item.label} Fader Level`,
			})
		}
	}

	instance.SCOPE_MUTE.forEach((item) => addNameVariables(item.choices))
	instance.SCOPE_MUTE_GROUP.forEach((item) => addNameVariables(item.choices))
	instance.SCOPE_FADER.forEach((item) => addLevelVariables(item.choices))

	instance.setVariableDefinitions(variables)

	// Set all level variables to a default placeholder
	const defaults = {}
	instance.SCOPE_FADER.forEach((item) => {
		for (const ch of item.choices) {
			defaults[`level_${ch.id}`] = '--'
		}
	})
	instance.setVariableValues(defaults)
}

module.exports = { initVariables }