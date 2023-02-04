import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let currentPanel: vscode.WebviewPanel | undefined = undefined;
	let currentTextEditor = vscode.window.activeTextEditor;

  context.subscriptions.push(
    vscode.commands.registerCommand('catCoding.start', () => {
      // Create and show panel
      currentPanel = vscode.window.createWebviewPanel(
        'catCoding',
        'Capybara Coding',
        vscode.ViewColumn.Two,
        {
					enableScripts: true
				}
      );

      // And set its HTML content
      currentPanel.webview.html = getWebviewContent();

			// handle webview messages
			currentPanel.webview.onDidReceiveMessage(
				message => {
					switch (message.command) {
						case 'addSketch':
							if (!currentTextEditor) {
								vscode.window.showWarningMessage("Please select some text before making a sketch.");
								return;
							};
							const selection = currentTextEditor.selection;
							const fileName = currentTextEditor.document.fileName;

							if (selection) {
									if (!currentPanel) return;
									currentPanel.webview.postMessage({
										command: 'sendSketchData', 
										start: selection.start.line,
										end: selection.end.line,
										file: fileName
									});
							}
							return;
					}
				},
				undefined,
				context.subscriptions
			);

			// disposal
			currentPanel.onDidDispose(
				() => {
					currentPanel = undefined;
				},
				undefined,
				context.subscriptions
			);

    })
  );

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => {
			if (vscode.window.activeTextEditor) {
				currentTextEditor = vscode.window.activeTextEditor;
			}
		})
	);

	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection(() => {
			if (!currentPanel) return;
			if (!currentTextEditor) return;
			const fileName = currentTextEditor.document.fileName;

			const selection = currentTextEditor.selection;
			currentPanel.webview.postMessage({ command: 'grabSelected', selection: selection.start.line, file: fileName});
		})
	);
}

function getWebviewContent() {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Capybara Coding</title>
	  <style>
		body {
		  margin-top: 20px;
		  margin-left: auto;
		  margin-right: auto;
		}
  
		#selection-range{
		  font-size: 15px;
		}
  
		#new-sketch-button {
		  padding: 10px 15px;
		  margin-bottom: 30px;
		  background-color: white;
		  border-radius: 17px;
		  font-weight: 600;
		}
  
		#new-sketch-button:hover {
		  background-color: gray;
		  color: white;
		}
  
		canvas{
		  border: solid;
		  border-radius: 5px;
		}
  
		.sketch-details{
		  margin-bottom: 10px;
		  margin-top: 20px;	  
		}
  
  </style>
  </head>
  <body>
	  <img src="https://media.tenor.com/BAa9ZAJiqxoAAAAC/capybara-onsen.gif" width="600px">
		  <p id="selection-range">select some code and attach a sketch to it!</p>
	  <button id="new-sketch-button">new sketch</button>
	  <div id="top-of-page"></div>
		  <script>
		(
		  function() {
			const vscode = acquireVsCodeApi();
			const sketches = [];
  
			// load in elems
			const selectionRange = document.getElementById('selection-range');
			const newSketchButton = document.getElementById('new-sketch-button');
			const topOfPage = document.getElementById('top-of-page');
  
			// post selection range
			window.addEventListener('message', e => {
			  const message = e.data;
			  switch (message.command) {
  
				// receive data to generate sketch
				case "sendSketchData":
				  let sketchData = [message.start, message.end, message.file]
				  addNewSketch(sketchData);
				  return;
  
				// place the highlighted lines of code at the top
				case "grabSelected":
				  let inSelection = sketches.filter( (sketch) => {
					return (sketch.start <= message.selection && 
							sketch.end >= message.selection &&
							sketch.file == message.file);
				  } );
				  inSelection.forEach((sketch) => {
					let titleElem = document.getElementById(sketch.titleId);
					let canvasElem = document.getElementById(sketch.canvasId);
					titleElem.appendAfter(topOfPage);
					canvasElem.appendAfter(titleElem);
				  })
			  }
			});
  
			// add new sketch
			newSketchButton.onclick = () => {
			  vscode.postMessage({
				command: 'addSketch'
			  });
			}
  
			let addNewSketch = (sketchData) => {
			  // make sketch title elem
			  let joinStr = '....';
			  let id = sketchData.join(joinStr);
			  const title = document.createElement("div");
			  let titleId = id + joinStr + "title";
			  let i = 0;
			  while (document.getElementById(titleId + i)) {
				i += 1;
			  }
			  titleId = titleId + i;
			  title.id = titleId;
			  title.className = "sketch-details";
			  title.innerHTML = "start line: " + sketchData[0] + "<br>end line: " + sketchData[1] + "<br>file: " + sketchData[2];
			  document.body.appendChild(title);
			  title.appendAfter(topOfPage);
  
			  // make sketch canvas elem
			  const canvas = document.createElement("canvas");
			  const ctx = canvas.getContext("2d");
			  canvas.id = id + joinStr + "canvas" + i;
			  document.body.appendChild(canvas);
			  canvas.appendAfter(title);
  
			  sketches.push({
				start: sketchData[0],
				end: sketchData[1],
				file: sketchData[2],
				titleId: title.id,
				canvasId: canvas.id
			  });
  
			  canvas.height = 200;
			  canvas.width = 400;
  
			  ctx.fillStyle = "white";
			  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
			  let painting = false;
			  let startPos = () => painting = true;
			  let endPos = () => {
				painting = false;
				ctx.stroke();
				ctx.beginPath();
			  };
  
			  let draw = (event) => {
				if (!painting) return;
				ctx.lineWidth = 3;
				ctx.lineCap = "round";
				ctx.strokeStyle = "black";
  
				ctx.lineTo(getMousePos(canvas, event).x, getMousePos(canvas,event).y);
				ctx.stroke();
			  }
  
			  canvas.addEventListener("mousedown", startPos);
			  canvas.addEventListener("mouseup", endPos);
			  canvas.addEventListener("mousemove", draw);
			}
  
			let getMousePos = (canvas, event) => {
			  let rect = canvas.getBoundingClientRect();
			  return {
				  x: (event.clientX - rect.left) / (rect.right - rect.left) * canvas.width,
				  y: (event.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
			  };
			}
  
			Element.prototype.appendAfter = function (element) {
			  element.parentNode.insertBefore(this, element.nextSibling);
			},false;
  
		  }()
		)
		  </script>
  </body>
  </html>`;
}
