const { InstanceBase, TCPHelper, runEntrypoint } = require('@companion-module/base')
const { getConfigFields } = require('./config')
const { initActions } = require('./actions')
const { initFeedbacks } = require('./feedbacks')
const { initVariables } = require('./variables')
const { initPresets } = require('./presets')
const mixerconfig = require('../mixerconfig.json')

class RolandM5000Instance extends InstanceBase {
	constructor(internal) {
		super(internal)

		this.cmdPipe = []
		this.pollMixerTimer = undefined
		this.blinkTimer = undefined
		this.blinkState = false
		this.watchlist = new Map()
		this.pipeline = ''

		// Channel scope arrays
		this.SCOPE_PHANTOM = []
		this.SCOPE_EQ = []
		this.SCOPE_PAN = []
		this.SCOPE_MUTE = []
		this.SCOPE_MUTE_GROUP = []
		this.SCOPE_FADER = []
		this.SCOPE_BRIGHTNESS = []
		this.SCOPE_AUXSENDPANLEVEL = []
	}

	// Called when the module is first loaded or config is saved
	async init(config) {
		this.config = config
		this.updateStatus('connecting')

		this.initMixerData()
		initVariables(this)
		initActions(this)
		initFeedbacks(this)
		initPresets(this)

		this.initTCP()
		this.initPolling()
		this.initBlink()
	}

	// Called when the module is destroyed
	async destroy() {
		if (this.socket) {
			this.socket.destroy()
			this.socket = undefined
		}
		if (this.pollMixerTimer) {
			clearInterval(this.pollMixerTimer)
			this.pollMixerTimer = undefined
		}
		if (this.blinkTimer) {
			clearInterval(this.blinkTimer)
			this.blinkTimer = undefined
		}
		this.log('debug', 'Module destroyed')
	}

	// Called when config is updated
	async configUpdated(config) {
		this.config = config

		if (this.pollMixerTimer) {
			clearInterval(this.pollMixerTimer)
			this.pollMixerTimer = undefined
		}
		if (this.blinkTimer) {
			clearInterval(this.blinkTimer)
			this.blinkTimer = undefined
		}
		if (this.socket) {
			this.socket.destroy()
			this.socket = undefined
		}

		this.initMixerData()
		initVariables(this)
		initActions(this)
		initFeedbacks(this)
		initPresets(this)

		this.initTCP()
		this.initPolling()
		this.initBlink()
	}

	// Returns config field definitions
	getConfigFields() {
		return getConfigFields(this)
	}

	// Build channel choice arrays based on mixer model
	initMixerData() {
		const mx = mixerconfig.modelconfig[this.config.model || 'M-5000']

		const initChoiceArray = (count, prefix, label) => {
			let result = []
			for (let i = 1; i <= count; i++) {
				result.push({ id: `${prefix}${i}`, label: `${label} ${i}` })
			}
			return result
		}

		const CHOICES_INPUT = initChoiceArray(mx.ICount, 'I', 'Channel')
		const CHOICES_SUBGROUP = initChoiceArray(mx.SGCount, 'SG', 'Subgroup')
		const CHOICES_AUX = initChoiceArray(mx.AXCount, 'AX', 'Aux')
		const CHOICES_MIXMINUS = initChoiceArray(mx.MMCount, 'MM', 'Mix Minus')
		const CHOICES_MATRIX = initChoiceArray(mx.MXCount, 'MX', 'Matrix')
		const CHOICES_MONITOR = initChoiceArray(mx.MONCount, 'MON', 'Monitor')
		const CHOICES_DCA = initChoiceArray(mx.DCACount, 'DCA', 'DCA')
		const CHOICES_MUTEGROUP = initChoiceArray(mx.MGCount, 'MG', 'Mute Group')
		const CHOICES_RETURN = initChoiceArray(mx.RCount, 'R', 'Return')

		// Return mono split
		let CHOICES_RETURN_MONO = []
		for (const item of CHOICES_RETURN) {
			CHOICES_RETURN_MONO.push({ id: item.id + 'L', label: item.label + ' L' })
			CHOICES_RETURN_MONO.push({ id: item.id + 'R', label: item.label + ' R' })
		}

		// User channels
		let CHOICES_USER = []
		for (let i = 1; i <= mx.UserSets; i++) {
			for (let j = 1; j <= mx.UCount; j++) {
				CHOICES_USER.push({
					id: 'U' + (mx.UCount * i - mx.UCount + j),
					label: `User ${i}: Fader ${j}`,
				})
			}
		}

		// Main channels vary by model
		let CHOICES_MAIN = []
		switch (this.config.model) {
			case 'M-5000':
				CHOICES_MAIN = [
					{ id: 'MA1', label: 'Main 1' },
					{ id: 'MA2', label: 'Main 2' },
				]
				break
			case 'M-480':
			case 'M-400':
			case 'M-380':
			case 'M-300':
				CHOICES_MAIN = [
					{ id: 'MAL', label: 'Main Left' },
					{ id: 'MAR', label: 'Main Right' },
					{ id: 'MAC', label: 'Main Centre' },
				]
				break
			case 'M-200':
				CHOICES_MAIN = [
					{ id: 'MAL', label: 'Main Left' },
					{ id: 'MAR', label: 'Main Right' },
				]
				break
		}

		// Build scopes
		this.SCOPE_PHANTOM = [
			{ channel: 'input', choices: CHOICES_INPUT },
			{ channel: 'user', choices: CHOICES_USER },
		]
		this.SCOPE_EQ = [
			{ channel: 'input', choices: CHOICES_INPUT },
			{ channel: 'aux', choices: CHOICES_AUX },
			{ channel: 'matrix', choices: CHOICES_MATRIX },
			{ channel: 'main', choices: CHOICES_MAIN },
			{ channel: 'user', choices: CHOICES_USER },
		]
		this.SCOPE_PAN = [
			{ channel: 'input', choices: CHOICES_INPUT },
			{ channel: 'aux', choices: CHOICES_AUX },
			{ channel: 'matrix', choices: CHOICES_MATRIX },
			{ channel: 'user', choices: CHOICES_USER },
		]
		this.SCOPE_MUTE = [
			{ channel: 'input', choices: CHOICES_INPUT },
			{ channel: 'aux', choices: CHOICES_AUX },
			{ channel: 'matrix', choices: CHOICES_MATRIX },
			{ channel: 'dca', choices: CHOICES_DCA },
			{ channel: 'user', choices: CHOICES_USER },
			{ channel: 'main', choices: CHOICES_MAIN },
		]
		this.SCOPE_MUTE_GROUP = [{ channel: 'mutegroup', choices: CHOICES_MUTEGROUP }]
		this.SCOPE_FADER = [
			{ channel: 'input', choices: CHOICES_INPUT },
			{ channel: 'aux', choices: CHOICES_AUX },
			{ channel: 'matrix', choices: CHOICES_MATRIX },
			{ channel: 'main', choices: CHOICES_MAIN },
			{ channel: 'dca', choices: CHOICES_DCA },
			{ channel: 'user', choices: CHOICES_USER },
		]
		this.SCOPE_AUXSENDPANLEVEL = [
			{ channel: 'input', choicesC: CHOICES_INPUT, choicesA: CHOICES_AUX },
			{ channel: 'user', choicesC: CHOICES_USER, choicesA: CHOICES_AUX },
		]
		this.SCOPE_BRIGHTNESS = ['panel', 'display']

		// Model-specific scope additions
		switch (this.config.model) {
			case 'M-5000':
				this.SCOPE_EQ.push(
					{ channel: 'subgroup', choices: CHOICES_SUBGROUP },
					{ channel: 'mixminus', choices: CHOICES_MIXMINUS }
				)
				this.SCOPE_PAN.push({ channel: 'subgroup', choices: CHOICES_SUBGROUP })
				this.SCOPE_MUTE.push(
					{ channel: 'subgroup', choices: CHOICES_SUBGROUP },
					{ channel: 'mixminus', choices: CHOICES_MIXMINUS }
				)
				this.SCOPE_FADER.push(
					{ channel: 'subgroup', choices: CHOICES_SUBGROUP },
					{ channel: 'mixminus', choices: CHOICES_MIXMINUS },
					{ channel: 'monitor', choices: CHOICES_MONITOR }
				)
				this.SCOPE_BRIGHTNESS.push('lamp')
				break
			case 'M-480':
				this.SCOPE_PHANTOM.push({ channel: 'return', choices: CHOICES_RETURN_MONO })
				this.SCOPE_PAN.push({ channel: 'return', choices: CHOICES_RETURN_MONO })
				this.SCOPE_MUTE.push({ channel: 'return', choices: CHOICES_RETURN })
				this.SCOPE_FADER.push({ channel: 'return', choices: CHOICES_RETURN })
				this.SCOPE_BRIGHTNESS.push('lamp')
				break
			case 'M-400':
			case 'M-380':
				this.SCOPE_BRIGHTNESS.push('lamp')
				break
		}
	}

	// TCP connection
	initTCP() {
		if (this.socket) {
			this.socket.destroy()
			this.socket = undefined
		}

		if (!this.config.host) {
			this.updateStatus('bad_config', 'No host configured')
			return
		}

		this.socket = new TCPHelper(this.config.host, this.config.port || 8023)

		this.socket.on('status_change', (status, message) => {
			this.updateStatus(status, message)
		})

		this.socket.on('error', (err) => {
			this.log('error', `Network error: ${err.message}`)
			this.updateStatus('connection_failure', err.message)
		})

		this.socket.on('connect', () => {
			this.log('info', 'Connected to mixer')
			this.updateStatus('ok')
			this.initChannelNames()
		})

		this.socket.on('data', (data) => {
			this.pipeline += data.toString('utf8')
			this.processIncomingData()
		})
	}

	// Parse incoming TCP data
	processIncomingData() {
		this.log('debug', `RX raw: ${JSON.stringify(this.pipeline)}`)

		// Simple ACK (06H) - success response to a control command
		if (this.pipeline.length === 1 && this.pipeline.charCodeAt(0) === 6) {
			this.cmdPipeNext()
			this.pipeline = ''
			return
		}

		// Buffer partial responses until we have complete messages
		if (this.pipeline.includes('\u0002') && this.pipeline.includes(';')) {
			const responses = this.pipeline.split(';')
			this.pipeline = responses.pop() // keep any partial response
			for (const response of responses) {
				if (response.length > 0) {
					this.processResponse(response)
				}
			}
		}
	}

	// Process a single complete response from the mixer
	processResponse(response) {
		// Strip any leading ACK bytes
		while (response.charAt(0) !== '\u0002') {
			if (response.charCodeAt(0) === 6) {
				this.cmdPipeNext()
				response = response.slice(1)
			} else {
				response = response.slice(1)
			}
			if (response.length === 0) return
		}

		const pipeItem = this.cmdPipeNext()

		// Error response
		if (response.substring(1, 5) === 'ERR:') {
			const errCode = response.substring(5, 6)
			const errMap = { '0': 'Syntax Error', '2': 'Busy Error', '5': 'Out of Range', '6': 'Unknown Error' }
			const errString = errMap[errCode] || 'Unrecognised Error'
			if (errCode !== '5' || this.config.range_errors_enabled) {
				this.log('error', `Mixer error: ${errString} — Command: ${pipeItem}`)
			}
			return
		}

		// Valid response: <stx>**S:args
		const category = response.substring(1, 3)
		const separator = response.substring(3, 5)
		const argString = response.substring(5)
		const args = argString.split(',')

		if (separator !== 'S:') {
			this.log('error', `Unexpected response format: ${response}`)
			return
		}

		const key = this.buildWatchKey(category, args[0])

		switch (category) {
			case 'MU':
			case 'PT':
			case 'EQ':
				this.updateWatchItem(key, args)
				this.checkFeedbacks()
				break
			case 'FD':
				this.log('debug', `FD response: channel=${args[0]} level=${args[1]}`)
				this.updateWatchItem(key, args)
				// Expose fader level as a variable — fixes missing variable bug from original
				this.setVariableValues({ [`level_${args[0]}`]: args[1] })
				this.checkFeedbacks()
				break
			case 'CN':
				// Channel name — strip enclosing quotes
				this.setVariableValues({ [`name_${args[0]}`]: args[1].replace(/^"|"$/g, '') })
				break
		}
	}

	// Send a command to the mixer
	sendCommand(cmd) {
		if (!cmd) return
		if (this.socket && this.socket.isConnected) {
			this.socket.send('\u0002' + cmd + ';')
			this.cmdPipe.unshift(cmd)
		} else {
			this.log('debug', 'Socket not connected — command dropped')
		}
	}

	// Watchlist helpers
	buildWatchKey(category, params) {
		return `${category}Q:${params}`
	}

	addWatchItem(category, params, id) {
		const key = this.buildWatchKey(category, params)
		if (this.watchlist.has(key)) {
			this.watchlist.get(key).ids.add(id)
		} else {
			this.watchlist.set(key, { ids: new Set([id]), args: [] })
		}
	}

	removeWatchItem(category, params, id) {
		const key = this.buildWatchKey(category, params)
		if (this.watchlist.has(key)) {
			const item = this.watchlist.get(key)
			item.ids.delete(id)
			if (item.ids.size === 0) {
				this.watchlist.delete(key)
			}
		}
	}

	updateWatchItem(key, args) {
		if (this.watchlist.has(key)) {
			this.watchlist.get(key).args = args
		} else {
			this.log('error', `Cannot update unknown watchlist item: ${key}`)
		}
	}

	cmdPipeNext() {
		if (this.cmdPipe.length > 0) {
			return this.cmdPipe.pop()
		}
		this.log('error', 'Unexpected response — pipe underrun')
		return ''
	}

	// Request channel names from mixer on connect
	initChannelNames() {
		const requestNames = (choices) => {
			for (const item of choices) {
				this.setVariableValues({ [`name_${item.id}`]: item.label })
				this.sendCommand(this.buildWatchKey('CN', item.id))
			}
		}
		this.SCOPE_MUTE.forEach((item) => requestNames(item.choices))
		this.SCOPE_MUTE_GROUP.forEach((item) => requestNames(item.choices))
	}

	// Polling loop
	initPolling() {
		if (!this.config.polling_enabled) return
		if (this.pollMixerTimer) return

		this.pollMixerTimer = setInterval(() => {
			for (const key of this.watchlist.keys()) {
				this.sendCommand(key)
			}
		}, this.config.poll_interval || 500)
	}

	// Blink timer — toggles blinkState and re-evaluates feedbacks for mute pulse effect
	initBlink() {
		if (this.blinkTimer) return

		this.blinkTimer = setInterval(() => {
			this.blinkState = !this.blinkState
			this.checkFeedbacks()
		}, 600)
	}
}

runEntrypoint(RolandM5000Instance, [])