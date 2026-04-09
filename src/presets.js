const { combineRgb } = require('@companion-module/base')

const initPresets = (instance) => {
	const presets = {}

	// -------------------------------------------------------------------------
	// Preset factories
	// -------------------------------------------------------------------------

	const mutePreset = (channel, channelType, choice) => ({
		type: 'button',
		category: `${channelType.toUpperCase()} Mute`,
		name: `${choice.label} Mute Toggle`,
		style: {
			text: `$(${instance.label}:name_${choice.id})`,
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [
			{
				down: [
					{
						actionId: `${channelType}_channel_mute`,
						options: {
							channel: choice.id,
							switch: 'T',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: `${channelType}_channel_mute`,
				options: {
					channel: choice.id,
				},
				style: {
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(255, 0, 0),
				},
			},
			{
				feedbackId: `${channelType}_channel_level`,
				options: {
					channel: choice.id,
				},
			},
		],
	})

	const faderUpPreset = (channelType, choice, increment) => ({
		type: 'button',
		category: `${channelType.toUpperCase()} Fader`,
		name: `${choice.label} Fader Up`,
		style: {
			text: '▲',
			size: '24',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 80, 0),
		},
		steps: [
			{
				down: [
					{
						actionId: `${channelType}_channel_relativefaderlevel`,
						options: {
							channel: choice.id,
							level: String(increment),
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	})

	const faderDownPreset = (channelType, choice, increment) => ({
		type: 'button',
		category: `${channelType.toUpperCase()} Fader`,
		name: `${choice.label} Fader Down`,
		style: {
			text: '▼',
			size: '24',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(80, 0, 0),
		},
		steps: [
			{
				down: [
					{
						actionId: `${channelType}_channel_relativefaderlevel`,
						options: {
							channel: choice.id,
							level: String(-increment),
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	})

	// -------------------------------------------------------------------------
	// Register presets from scopes
	// -------------------------------------------------------------------------

	const increment = instance.config.rf_increment || 1

	instance.SCOPE_MUTE.forEach((item) => {
		// Only generate presets for first channel of each type to keep list manageable
		const choice = item.choices[0]
		if (!choice) return
		presets[`${item.channel}_mute_${choice.id}`] = mutePreset(
			item.channel,
			item.channel,
			choice
		)
	})

	instance.SCOPE_FADER.forEach((item) => {
		const choice = item.choices[0]
		if (!choice) return
		presets[`${item.channel}_fader_up_${choice.id}`] = faderUpPreset(
			item.channel,
			choice,
			increment
		)
		presets[`${item.channel}_fader_down_${choice.id}`] = faderDownPreset(
			item.channel,
			choice,
			increment
		)
	})

	instance.setPresetDefinitions(presets)
}

module.exports = { initPresets }