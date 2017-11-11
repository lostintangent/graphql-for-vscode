/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import {
  commands,
  ExtensionContext,
  StatusBarAlignment,
  TextEditor,
  window,
  workspace,
} from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  NotificationType,
  ServerOptions,
  State as ClientState,
  TransportKind,
} from 'vscode-languageclient';

enum Status {
  init = 1,
  ok = 2,
  error = 3,
}
const extName = 'graphqlForVSCode';
const GQL_LANGUAGE_SERVER_CLI_PATH = require.resolve(
  '@playlyfe/gql-language-server/lib/bin/cli',
);

const statusBarText = 'GQL';
const statusBarUIElements = {
  [Status.init]: {
    icon: 'sync',
    color: 'white',
    tooltip: 'Graphql language server is initializing',
  },
  [Status.ok]: {
    icon: 'plug',
    color: 'while',
    tooltip: 'Graphql language server is running',
  },
  [Status.error]: {
    icon: 'stop',
    color: 'red',
    tooltip: 'Graphql language server has stopped',
  },
};
const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 0);
let extensionStatus: Status = Status.ok;
let serverRunning: boolean = false;
const statusBarActivationLanguageIds = [
  'graphql',
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
];

export function activate(context: ExtensionContext) {
  // The debug options for the server
  const debugOptions = { execArgv: ['--nolazy', '--debug=6004'] };

  const configuration = workspace.getConfiguration(extName);

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: {
      module: GQL_LANGUAGE_SERVER_CLI_PATH,
      transport: TransportKind.ipc,
      args: [
        configuration.has('watchman')
          ? `--watchman=${configuration.get('watchman')}`
          : null,
        configuration.has('autoDownloadGQL')
          ? `--auto-download-gql=${configuration.get('autoDownloadGQL')}`
          : null,
      ].filter(Boolean),
    },
    debug: {
      module: GQL_LANGUAGE_SERVER_CLI_PATH,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    diagnosticCollectionName: 'graphql',
    initializationOptions: () => {
      return {
        nodePath: configuration
          ? configuration.get('nodePath', undefined)
          : undefined,
        debug: configuration ? configuration.get('debug', false) : false,
      };
    },
    initializationFailedHandler: error => {
      window.showErrorMessage(
        "VSCode for Graphql couldn't start. See output channel for more details.",
      );
      client.error('Server initialization failed:', error.message);
      client.outputChannel.show(true);
      return false;
    },
  };

  // Create the language client and start the client.
  const client = new LanguageClient(
    'Graphql For VSCode',
    serverOptions,
    clientOptions,
  );

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(
    client.start(),
    commands.registerCommand('graphqlForVSCode.showOutputChannel', () => {
      client.outputChannel.show();
    }),
    statusBarItem,
  );

  initializeStatusBar(context, client);

  client.onReady().then(() => {
    extensionStatus = Status.ok;
    serverRunning = true;
    updateStatusBar(window.activeTextEditor);
  }, () => {
    extensionStatus = Status.error;
    serverRunning = false;
    updateStatusBar(window.activeTextEditor);
  });
}

function initializeStatusBar(context, client) {
  extensionStatus = Status.init;

  client.onDidChangeState(event => {
    if (event.newState === ClientState.Running) {
      extensionStatus = Status.ok;
      serverRunning = true;
    } else {
      extensionStatus = Status.error;
      client.info('The graphql server has stopped running');
      serverRunning = false;
    }
    updateStatusBar(window.activeTextEditor);
  });

  updateStatusBar(window.activeTextEditor);

  window.onDidChangeActiveTextEditor((editor: TextEditor) => {
    // update the status if the server is running
    updateStatusBar(editor);
  });
}

function updateStatusBar(editor: TextEditor) {
  extensionStatus = serverRunning ? Status.ok : Status.error;
  const statusUI = statusBarUIElements[extensionStatus];
  statusBarItem.text = `$(${statusUI.icon}) ${statusBarText}`;
  statusBarItem.tooltip = statusUI.tooltip;
  statusBarItem.command = 'graphqlForVSCode.showOutputChannel';
  statusBarItem.color = statusUI.color;

  if (
    editor &&
    statusBarActivationLanguageIds.indexOf(editor.document.languageId) > -1
  ) {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}
