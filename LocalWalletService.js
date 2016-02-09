'use strict';


const spawn = require('cross-spawn-async');
const blockchain = require('blockchain.info');

//
// Empty wallet
// Used to log out other wallets
//
const defaultWallet = {
	identifier: '7a49feee-3820-4b28-858f-6c9ec21844e0',
	password: 'LogOutWallet123!'
};


const baseConfig = {
	apiCode: null,
	servicePort: 3000
};

//
// Local Wallet Service
//
class LocalWalletService {
	constructor(config) {
		this.config = Object.assign({}, baseConfig, config);

		this.startLocalBlockchainWalletService();
	}

	startLocalBlockchainWalletService() {		
		this.blockchainWalletServiceProcess = spawn('blockchain-wallet-service', ['start', '--port', this.config.servicePort]);
	}

	//
	// Unencrypted payment
	// Goes directly to payment service, credentials are cleartext
	//
	makePayment(credentials, receiveAddress, amountInSatoshi) {

		return this.loginWallet(credentials)
			.then(wallet => {
				console.log(`Making a new payment (Satoshi ${amountInSatoshi}) to (Address ${receiveAddress})`);
				return wallet.send(receiveAddress, amountInSatoshi);
			})
			.then(paymentResponse => {
				//
				// Log out wallet by logging in the default wallet
				//
				this.loginWallet(defaultWallet);

				return paymentResponse;
			})
			.catch(error => {
				if (typeof error === 'string') {
					try {
						error = JSON.parse(error);
					} catch (ex) {}	// eslint-disable-line no-empty
				}

				throw {
					name: 'wallet-payment-error',
					message: error
				};
			});
	}

	loginWallet(credentials) {
		return new Promise((resolve, reject) => {
			const identifier = credentials.identifier;
			const password = credentials.password;

			const wallet = new blockchain.MyWallet(identifier, password, {
				apiCode: this.config.apiCode,
				apiHost: `http://127.0.0.1:${this.config.servicePort}`
			});

			this.fixMyWalletParamsHack(wallet);

			wallet.login()
				.then(() => resolve(wallet))
				.catch(error => reject(error));
		});
	}

	//
	// Last version checked where this fix is needed: "blockchain.info": "2.2.0"
	// 
	// MyWallet implementation sets the query parameter name for receiving addres as "address" but the API expects the query parameter name "to".
	// The MyWallet has a function called "getParams" which returns an object that the query parameters are added to.
	// We override this function and add a getter with the name "to" to the returned object that returns the value of "address".
	//
	fixMyWalletParamsHack(wallet) {
		const _getParams = wallet.getParams.bind(wallet);

		wallet.getParams = () => {
			const params = _getParams();

			Object.defineProperty(params, 'to', {
				enumerable: true,
				configurable: true,
				get() {
					return this.address;
				},
				set(value) {
					// If the "to" value is ever set, we remove our implementation and make it a regular property.
					delete this.to;
					this.to = value;
				}
			});

			return params;
		};
	}
}


if (require.main === module) {
	new LocalWalletService();
}

module.exports = LocalWalletService;
