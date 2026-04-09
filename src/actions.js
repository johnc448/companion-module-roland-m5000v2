const initActions = (instance) => {
	const actions = {}

	// -------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------

	const getToggleValue = (category, channel) => {
		const key = instance.buildWatchKey(category, channel)
		const item = instance.watchlist.get(key)
		if (!item || item.args[1] === undefined) return '1'
		return item.args[1] === '1' ? '0' : '1'
	}

	const getFaderMove = (channel, value) => {
		const key = instance.buildWatchKey('FD', channel)
		const item = instance.watchlist.get(key)
		let f = item ? parseFloat(item.args[1]) : 0
		if (!f || f === 0) f = 0.0001
		if (instance.config.log_fader_move_enabled) {
			const g = 4
			const result = Math.round(10 * (value * Math.exp(Math.log10(Math.abs(f / g))))) / 10
			return Math.abs(result) > Math.abs(value) ? result : value
		}
		return Math.round(10 * value) / 10
	}

	// -------------------------------------------------------------------------
	// Action factories
	// -------------------------------------------------------------------------

	const switchAction = (label, category, choices) => ({
		name: label,
		options: [
			{
				type: 'dropdown',
				label: 'Channel',
				id: 'channel',
				default: choices[0].id,
				choices,
			},
			{
				type: 'dropdown',
				label: 'On / Off / Toggle',
				id: 'switch',
				default: 'T',
				choices: [
					{ id: '1', label: 'On' },
					{ id: '0', label: 'Off' },
					{ id: 'T', label: 'Toggle' },
				],
			},
		],
		subscribe: (action) => {
			instance.addWatchItem(category, action.options.channel, action.id)
		},
		unsubscribe: (action) => {
			instance.removeWatchItem(category, action.options.channel, action.id)
		},
		callback: async (action) => {
			const ch = action.options.channel
			const val = action.options.switch === 'T' ? getToggleValue(category, ch) : action.options.switch
			instance.sendCommand(`${category}C:${ch},${val}`)
			// Optimistically update local state so toggle and feedbacks reflect the
			// new state immediately, without waiting for a polling response
			const key = instance.buildWatchKey(category, ch)
			const item = instance.watchlist.get(key)
			if (item) {
				item.args = [ch, val]
				instance.checkFeedbacks()
			}
		},
	})

	const faderAction = (label, choices) => ({
		name: label,
		options: [
			{
				type: 'dropdown',
				label: 'Channel',
				id: 'channel',
				default: choices[0].id,
				choices,
			},
			{
				type: 'textinput',
				label: 'Fader Level (INF, -80.0 to 10.0) in 0.1 dB steps',
				id: 'level',
				default: '0',
			},
		],
		subscribe: (action) => {
			instance.addWatchItem('FD', action.options.channel, action.id)
		},
		unsubscribe: (action) => {
			instance.removeWatchItem('FD', action.options.channel, action.id)
		},
		callback: async (action) => {
			const ch = action.options.channel
			const level = action.options.level
			instance.sendCommand(`FDC:${ch},${level}`)
			// We know the exact level — update variable and watchlist immediately
			instance.setVariableValues({ [`level_${ch}`]: level })
			const key = instance.buildWatchKey('FD', ch)
			const item = instance.watchlist.get(key)
			if (item) {
				item.args = [ch, level]
				instance.checkFeedbacks()
			}
		},
	})

	const relativeFaderAction = (label, choices) => ({
		name: label,
		options: [
			{
				type: 'dropdown',
				label: 'Channel',
				id: 'channel',
				default: choices[0].id,
				choices,
			},
			{
				type: 'textinput',
				label: 'Relative Level (-99.9 to 99.9) in 0.1 dB steps',
				id: 'level',
				default: String(instance.config.rf_increment || 1),
			},
		],
		subscribe: (action) => {
			instance.addWatchItem('FD', action.options.channel, action.id)
		},
		unsubscribe: (action) => {
			instance.removeWatchItem('FD', action.options.channel, action.id)
		},
		callback: async (action) => {
			const ch = action.options.channel
			const move = getFaderMove(ch, parseFloat(action.options.level))
			instance.sendCommand(`RFC:${ch},${move}`)
			// Update local tracking — M-200i doesn't respond to FDQ so we compute new level ourselves
			const key = instance.buildWatchKey('FD', ch)
			const item = instance.watchlist.get(key)
			if (item) {
				const current = item.args[1] === 'INF' ? -80 : (parseFloat(item.args[1]) || 0)
				const newLevel = Math.min(10, Math.max(-80, Math.round((current + move) * 10) / 10))
				const newLevelStr = newLevel <= -80 ? 'INF' : String(newLevel)
				item.args = [ch, newLevelStr]
				instance.setVariableValues({ [`level_${ch}`]: newLevelStr })
				instance.checkFeedbacks()
			}
		},
	})

	const panAction = (label, choices) => ({
		name: label,
		options: [
			{
				type: 'dropdown',
				label: 'Channel',
				id: 'channel',
				default: choices[0].id,
				choices,
			},
			{
				type: 'textinput',
				label: 'Pan (L100 to C to R100)',
				id: 'pan',
				default: 'C',
			},
		],
		callback: async (action) => {
			instance.sendCommand(`PNC:${action.options.channel},${action.options.pan.toUpperCase()}`)
		},
	})

	const auxSendPanAction = (label, choicesC, choicesA) => ({
		name: label,
		options: [
			{
				type: 'dropdown',
				label: 'Channel',
				id: 'channel',
				default: choicesC[0].id,
				choices: choicesC,
			},
			{
				type: 'dropdown',
				label: 'Aux Channel',
				id: 'aux',
				default: choicesA[0].id,
				choices: choicesA,
			},
			{
				type: 'textinput',
				label: 'Aux Send Level (INF, -80.0 to 10.0) in 0.1 dB steps',
				id: 'auxsendlevel',
				default: '0',
			},
			{
				type: 'textinput',
				label: 'Aux Pan (L100 to C to R100)',
				id: 'auxpan',
				default: 'C',
			},
		],
		callback: async (action) => {
			const { channel, aux, auxsendlevel, auxpan } = action.options
			instance.sendCommand(`AXC:${channel},${aux},${auxsendlevel},${auxpan.toUpperCase()}`)
		},
	})

	const brightnessAction = (label, cmd) => ({
		name: label,
		options: [
			{
				type: 'number',
				label: 'Brightness (0-100)',
				id: 'brightness',
				default: 75,
				min: 0,
				max: 100,
				range: true,
			},
		],
		callback: async (action) => {
			instance.sendCommand(`${cmd}:${action.options.brightness}`)
		},
	})

	// -------------------------------------------------------------------------
	// Register actions from scopes
	// -------------------------------------------------------------------------

	instance.SCOPE_PHANTOM.forEach((item) => {
		actions[`${item.channel}_channel_phantompower`] = switchAction(
			`${item.channel.toUpperCase()} Channel Phantom Power`,
			'PT',
			item.choices
		)
	})

	instance.SCOPE_EQ.forEach((item) => {
		actions[`${item.channel}_channel_eq`] = switchAction(
			`${item.channel.toUpperCase()} Channel EQ`,
			'EQ',
			item.choices
		)
	})

	instance.SCOPE_PAN.forEach((item) => {
		actions[`${item.channel}_channel_pan`] = panAction(
			`${item.channel.toUpperCase()} Channel Pan`,
			item.choices
		)
	})

	instance.SCOPE_MUTE.forEach((item) => {
		actions[`${item.channel}_channel_mute`] = switchAction(
			`${item.channel.toUpperCase()} Channel Mute`,
			'MU',
			item.choices
		)
	})

	instance.SCOPE_MUTE_GROUP.forEach((item) => {
		actions[`${item.channel}_channel_mute`] = switchAction(
			`${item.channel.toUpperCase()} Channel Mute`,
			'MU',
			item.choices
		)
	})

	instance.SCOPE_FADER.forEach((item) => {
		actions[`${item.channel}_channel_faderlevel`] = faderAction(
			`${item.channel.toUpperCase()} Channel Fader Level`,
			item.choices
		)
		actions[`${item.channel}_channel_relativefaderlevel`] = relativeFaderAction(
			`${item.channel.toUpperCase()} Channel Relative Fader Level`,
			item.choices
		)
	})

	instance.SCOPE_AUXSENDPANLEVEL.forEach((item) => {
		actions[`${item.channel}_channel_auxsendpanlevel`] = auxSendPanAction(
			`${item.channel.toUpperCase()} Channel Aux Send/Pan Level`,
			item.choicesC,
			item.choicesA
		)
	})

	instance.SCOPE_BRIGHTNESS.forEach((item) => {
		const cmdMap = { panel: 'PBC', display: 'DBC', lamp: 'LBC' }
		actions[`${item}_brightness`] = brightnessAction(
			`${item.toUpperCase()} Brightness`,
			cmdMap[item]
		)
	})

	// -------------------------------------------------------------------------
	// Standalone actions
	// -------------------------------------------------------------------------

	actions['monitor_dimmer'] = {
		name: 'Monitor Dimmer On/Off',
		options: [
			{
				type: 'dropdown',
				label: 'On/Off',
				id: 'switch',
				default: '0',
				choices: [
					{ id: '1', label: 'On' },
					{ id: '0', label: 'Off' },
				],
			},
		],
		callback: async (action) => {
			instance.sendCommand(`DMC:${action.options.switch}`)
		},
	}

	actions['scene_recall'] = {
		name: 'Recall Scene',
		options: [
			{
				type: 'textinput',
				label: 'Scene Number (1-300)',
				id: 'scene',
				default: '1',
			},
		],
		callback: async (action) => {
			instance.sendCommand(`SCC:${action.options.scene}`)
		},
	}

	actions['scene_relative_recall'] = {
		name: 'Recall Relative Scene',
		options: [
			{
				type: 'textinput',
				label: 'Relative Scene Number (-299 to 299)',
				id: 'scene',
				default: '1',
			},
		],
		callback: async (action) => {
			instance.sendCommand(`RSC:${action.options.scene}`)
		},
	}

	actions['scene_store'] = {
		name: 'Store Scene',
		options: [
			{
				type: 'textinput',
				label: 'Scene Number (1-300)',
				id: 'scene',
				default: '1',
			},
			{
				type: 'textinput',
				label: 'Scene Name (max 32 characters)',
				id: 'name',
				default: 'Scene 1',
			},
			{
				type: 'number',
				label: 'Memory (0=Off, 1-16)',
				id: 'memory',
				default: 1,
				min: 0,
				max: 16,
			},
		],
		callback: async (action) => {
			instance.sendCommand(`SSC:${action.options.scene},${action.options.name},${action.options.memory}`)
		},
	}

	actions['usb_record_start'] = {
		name: 'USB Recording: Start',
		options: [],
		callback: async () => { instance.sendCommand('RTC:P') },
	}

	actions['usb_record_stop'] = {
		name: 'USB Recording: Stop',
		options: [],
		callback: async () => { instance.sendCommand('RTC:S') },
	}

	actions['usb_record_pause'] = {
		name: 'USB Recording: Pause',
		options: [],
		callback: async () => { instance.sendCommand('RTC:R') },
	}

	actions['usb_record_jump'] = {
		name: 'USB Recording: Jump to Location',
		options: [
			{ type: 'textinput', label: 'Hour', id: 'hour', default: '0' },
			{ type: 'textinput', label: 'Minute', id: 'minute', default: '0' },
			{ type: 'textinput', label: 'Second', id: 'second', default: '0' },
		],
		callback: async (action) => {
			const { hour, minute, second } = action.options
			instance.sendCommand(`RLC:${hour}h${minute}m${second}s`)
		},
	}

	actions['usb_record_song'] = {
		name: 'USB Recording: Set Song',
		options: [
			{
				type: 'textinput',
				label: 'Song (0-999, +N/-N for relative, N=Next, P=Previous)',
				id: 'song',
				default: '0',
			},
		],
		callback: async (action) => {
			instance.sendCommand(`RIC:${action.options.song}`)
		},
	}

	actions['user_defined_string'] = {
		name: 'Send Raw Command (Testing)',
		options: [
			{
				type: 'textinput',
				label: 'Raw command string',
				id: 'cmd',
				default: '',
			},
		],
		callback: async (action) => {
			instance.sendCommand(action.options.cmd)
		},
	}

	instance.setActionDefinitions(actions)
}

module.exports = { initActions }