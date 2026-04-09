const { combineRgb } = require('@companion-module/base')

const initFeedbacks = (instance) => {
	const feedbacks = {}

	// -------------------------------------------------------------------------
	// Feedback factories
	// -------------------------------------------------------------------------

	// Boolean feedback for EQ, phantom power, etc.
	const stateFeedback = (label, category, choices) => ({
		type: 'boolean',
		name: label,
		description: `Show when ${label} is active`,
		defaultStyle: {
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(255, 0, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Channel',
				id: 'channel',
				default: choices[0].id,
				choices,
			},
		],
		subscribe: (feedback) => {
			instance.addWatchItem(category, feedback.options.channel, feedback.id)
		},
		unsubscribe: (feedback) => {
			instance.removeWatchItem(category, feedback.options.channel, feedback.id)
		},
		callback: (feedback) => {
			const key = instance.buildWatchKey(category, feedback.options.channel)
			const item = instance.watchlist.get(key)
			if (!item || item.args[1] === undefined) return false
			return item.args[1] === '1'
		},
	})

	// Advanced feedback for mute — pulses between bright and dark red when muted
	const muteFeedback = (label, choices) => ({
		type: 'advanced',
		name: label,
		description: `Pulse red when ${label} is muted`,
		options: [
			{
				type: 'dropdown',
				label: 'Channel',
				id: 'channel',
				default: choices[0].id,
				choices,
			},
		],
		subscribe: (feedback) => {
			instance.addWatchItem('MU', feedback.options.channel, feedback.id)
		},
		unsubscribe: (feedback) => {
			instance.removeWatchItem('MU', feedback.options.channel, feedback.id)
		},
		callback: (feedback) => {
			const key = instance.buildWatchKey('MU', feedback.options.channel)
			const item = instance.watchlist.get(key)
			if (!item || item.args[1] !== '1') return {}
			return {
				color: combineRgb(255, 255, 255),
				bgcolor: instance.blinkState ? combineRgb(255, 0, 0) : combineRgb(100, 0, 0),
			}
		},
	})

	const levelFeedback = (label, choices) => ({
		type: 'advanced',
		name: label,
		description: `Display current fader level for ${label}`,
		options: [
			{
				type: 'dropdown',
				label: 'Channel',
				id: 'channel',
				default: choices[0].id,
				choices,
			},
		],
		subscribe: (feedback) => {
			instance.addWatchItem('FD', feedback.options.channel, feedback.id)
		},
		unsubscribe: (feedback) => {
			instance.removeWatchItem('FD', feedback.options.channel, feedback.id)
		},
		callback: (feedback, context) => {
			const key = instance.buildWatchKey('FD', feedback.options.channel)
			const item = instance.watchlist.get(key)
			if (!item || item.args[1] === undefined) return {}
			const level = item.args[1]
			return {
				text: `${feedback.options.channel}\n${level}`,
			}
		},
	})

	// -------------------------------------------------------------------------
	// Register feedbacks from scopes
	// -------------------------------------------------------------------------

	instance.SCOPE_MUTE.forEach((item) => {
		feedbacks[`${item.channel}_channel_mute`] = muteFeedback(
			`${item.channel.toUpperCase()} Channel Mute`,
			item.choices
		)
	})

	instance.SCOPE_MUTE_GROUP.forEach((item) => {
		feedbacks[`${item.channel}_channel_mute`] = muteFeedback(
			`${item.channel.toUpperCase()} Mute Group`,
			item.choices
		)
	})

	instance.SCOPE_EQ.forEach((item) => {
		feedbacks[`${item.channel}_channel_eq`] = stateFeedback(
			`${item.channel.toUpperCase()} Channel EQ`,
			'EQ',
			item.choices
		)
	})

	instance.SCOPE_PHANTOM.forEach((item) => {
		feedbacks[`${item.channel}_channel_phantompower`] = stateFeedback(
			`${item.channel.toUpperCase()} Channel Phantom Power`,
			'PT',
			item.choices
		)
	})

	instance.SCOPE_FADER.forEach((item) => {
		feedbacks[`${item.channel}_channel_level`] = levelFeedback(
			`${item.channel.toUpperCase()} Channel Level`,
			item.choices
		)
	})

	instance.setFeedbackDefinitions(feedbacks)
}

module.exports = { initFeedbacks }