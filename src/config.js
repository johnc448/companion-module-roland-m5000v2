const { Regex } = require('@companion-module/base')

const getConfigFields = (instance) => {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'Controls Roland M-5000 via ethernet, or M-2/3/4xx via serial bridge. The M-5000 listens on TCP port 8023.',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'IP Address',
			width: 6,
			default: '192.168.0.1',
			regex: Regex.IP,
		},
		{
			type: 'number',
			id: 'port',
			label: 'TCP Port',
			width: 4,
			default: 8023,
			min: 1,
			max: 65535,
		},
		{
			type: 'dropdown',
			id: 'model',
			label: 'Console Model',
			width: 6,
			default: 'M-5000',
			choices: [
				{ id: 'M-5000', label: 'M-5000' },
				{ id: 'M-480', label: 'M-480' },
				{ id: 'M-400', label: 'M-400' },
				{ id: 'M-380', label: 'M-380' },
				{ id: 'M-300', label: 'M-300' },
				{ id: 'M-200', label: 'M-200i' },
			],
		},
		{
			type: 'checkbox',
			id: 'polling_enabled',
			label: 'Enable Mixer Polling',
			default: true,
			width: 6,
		},
		{
			type: 'number',
			id: 'poll_interval',
			label: 'Polling Interval (ms)',
			width: 6,
			min: 300,
			max: 30000,
			default: 500,
		},
		{
			type: 'number',
			id: 'rf_increment',
			label: 'Relative Fader Increment (dB)',
			width: 6,
			min: 0,
			max: 15,
			default: 1,
			step: 0.1,
		},
		{
			type: 'checkbox',
			id: 'log_fader_move_enabled',
			label: 'Use Logarithmic Scaling for Relative Fader Moves',
			default: true,
			width: 8,
		},
		{
			type: 'checkbox',
			id: 'range_errors_enabled',
			label: 'Show Out-Of-Range Errors in Log',
			default: false,
			width: 8,
		},
	]
}

module.exports = { getConfigFields }