import '../libs/webaudio-controls.js';
import '../volumeButton/index.js';

const getBaseURL = () => {
    return new URL('.', import.meta.url);
};

// save du bouton volume au cas où
/* <webaudio-knob id="volumeKnob" 
      src="../assets/imgs/vernier.png" 
      value=5 min=0 max=20 step=0.01 
      diameter="100" 
      tooltip="Volume: %d">
    </webaudio-knob> */

const template = document.createElement("template");
template.innerHTML = /*html*/`
  <style>
  .gui{background-color: slategrey; width : 50%;}
  div.lesBoutons{vertical-align: top; display: inline-block; text-align: center;}
  label{display: block;}
  canvas {
      border:1px solid black;
    }
  #volumeButton{display: inline-block;}
  #balanceButton{display: inline-block;}
  #param-balanceGaucheDroite{display: none;}
  </style>
  <div class="gui">
    <canvas id="myCanvas" width=400></canvas>
    <audio id="myPlayer" crossorigin="anonymous"></audio>
    <br>
    <div class="lesBoutons">
        <!--là on va mettre le bouton de volume-->
        <div id="volumeButton">
            <webaudio-knob id="volumeKnob" 
                src="../assets/imgs/vernier.png" 
                value=5 min=0 max=20 step=0.01 
                diameter="100" 
                tooltip="Volume: %d">
            </webaudio-knob>
            <label>Volume</label>
        </div>

        <!--là on va mettre le bouton des balances-->
        <div id="balanceButton"> 
            <webaudio-knob
            id="balanceGaucheDroite"
            src="../assets/imgs/WOK_vintage_AbbeyRoad_PAN_Knob.png"
            sprites="127"
            value=50>
            </webaudio-knob>
            <label>Balance</label>
            <webaudio-param id="param-balanceGaucheDroite" min="-1" max="1"></webaudio-param>
        </div>
        <volume-button class="volumetonbou">Volume</volume-button>
        <br>
    </div>
    
    <div class="playerControls">
        <button id="play">Play</button>
        <button id="play">
            <img src="../assets/imgs/video.png" width="20"/>
        </button> 
        <button id="pause">Pause</button>
        <button id="avance10">+10s</button>
        <button id="recule10">-10s</button>
        <button id="stop">Stop</button> 
        <button id="reload">Relancer</button> 
    </div>
    <br>
    
    <br>
    Progression : 
    <webaudio-slider id="progress" width="300" height="30"></webaudio-slider>
    </br>
    
    <webaudio-slider id="vitesseLecture" height="300" 
        src="myComponents/assets/imgs/vsliderbody.png" 
        knobsrc="myComponents/assets/imgs/vsliderknob.png"
        min=0.2 max=4 step=0.1 value=1>
    </webaudio-slider>
    <label>Vitesse de lecture</label>
  </div>
  `;

class MyAudioPlayer extends HTMLElement {
    constructor() {
        super();
        // Récupération des attributs HTML
        //this.value = this.getAttribute("value");

        // On crée un shadow DOM
        this.attachShadow({ mode: "open" });

        console.log("URL de base du composant : " + getBaseURL())

        //pour la balance 
        // this.createIds();
    }

    connectedCallback() {
        
        // Appelée automatiquement par le browser
        // quand il insère le web component dans le DOM
        // de la page du parent..

        // On clone le template HTML/CSS (la gui du wc)
        // et on l'ajoute dans le shadow DOM
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        // fix relative URLs
        this.fixRelativeURLs();

        

        //balance
        this.shadowRoot.querySelector("#param-balanceGaucheDroite").oninput = (e) => {
            let value = parseInt(this.shadowRoot.querySelector("#param-balanceGaucheDroite > input").value)
            this.shadowRoot.querySelector("#balanceGaucheDroite").value = value == NaN ? value : 0;
        }
        this.shadowRoot.querySelectorAll (".webaudioctrl-tooltip").forEach ((elem) => elem.remove ())

        //volume
        this.shadowRoot.querySelector("#volumeKnob").oninput = () => this.switchVolume ()

        this.player = this.shadowRoot.querySelector("#myPlayer");
        this.player.src = this.getAttribute("src");

        // récupérer le canvas
        this.canvas = this.shadowRoot.querySelector("#myCanvas");
        this.ctx = this.canvas.getContext("2d");

        // Récupération du contexte WebAudio
        this.audioCtx = new AudioContext();

        // on définit les écouteurs etc.
        this.defineListeners();

        // On construit un graphe webaudio pour capturer
        // le son du lecteur et pouvoir le traiter
        // en insérant des "noeuds" webaudio dans le graphe
        this.buildAudioGraph();

        // on démarre l'animation
        requestAnimationFrame(() => {
            this.animationLoop();
        });

        // test affichage du bouton volume
        // this.shadowRoot.querySelector("#volumeButton").init();

        // test du volume
        // this.shadowRoot.querySelector ("#volumeKnob").oninput = () => this.switchVolume ()
    }

    setAudioController (audioController) {
        this.audioController = audioController
    }

    setBalanceGaucheDroite () {
        let balance = this.audioController.audioCtx.createStereoPanner();
        this.shadowRoot.querySelector("#param-balanceGaucheDroite").value = Math.round(this.shadowRoot.querySelector("#balanceGaucheDroite").value*100)/100
        this.shadowRoot.querySelector("#balanceGaucheDroite").oninput = (e) => {
            balance.pan.value = e.target.value
            this.shadowRoot.querySelector("#param-balanceGaucheDroite").value = Math.round(e.target.value*10)/10
        }
        return balance
    }

    init () {
        //volume
        this.switchVolume ()
        this.switchVolume ()

        //balance
        var filters = [];
        filters.push (this.setBalanceGaucheDroite ())

        // Connect filters in serie
        this.audioController.mediaElementSource.connect(filters[0]);
        for(var i = 0; i < filters.length - 1; i++) {
            filters[i].connect(filters[i+1]);
            }

        // connect the last filter to the speakers
        filters[filters.length-1].connect(this.audioController.audioCtx.destination);
    }

    buildAudioGraph() {
        let audioContext = this.audioCtx;

        let playerNode = audioContext.createMediaElementSource(this.player);

        // Create an analyser node
        this.analyserNode = audioContext.createAnalyser();

        // Try changing for lower values: 512, 256, 128, 64...
        this.analyserNode.fftSize = 256;
        this.bufferLength = this.analyserNode.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);

        // lecteur audio -> analyser -> haut parleurs
        playerNode.connect(this.analyserNode);
        this.analyserNode.connect(audioContext.destination);
    }


animationLoop() {
    // 1 on efface le canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 2 on dessine les objets
    //this.ctx.fillRect(10+Math.random()*20, 10, 100, 100);
    // Get the analyser data
    this.analyserNode.getByteFrequencyData(this.dataArray);

    let barWidth = this.canvas.width / this.bufferLength;
    let barHeight;
    let x = 0;

    // values go from 0 to 256 and the canvas heigt is 100. Let's rescale
    // before drawing. This is the scale factor
    let heightScale = this.canvas.height / 128;

    for (let i = 0; i < this.bufferLength; i++) {
        barHeight = this.dataArray[i];

        this.ctx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
        barHeight *= heightScale;
        this.ctx.fillRect(x, this.canvas.height - barHeight / 2, barWidth, barHeight / 2);

        // 2 is the number of pixels between bars
        x += barWidth + 1;
    }
    // 3 on deplace les objets

    // 4 On demande au navigateur de recommencer l'animation
    requestAnimationFrame(() => {
        this.animationLoop();
    });
}
fixRelativeURLs() {
    const elems = this.shadowRoot.querySelectorAll("webaudio-knob, webaudio-switch, img");
    elems.forEach(e => {
        const path = e.src;
        if (path.startsWith(".")) {
            e.src = getBaseURL() + path;
        }
    });
}
defineListeners() {
    this.shadowRoot.querySelector("#play").onclick = () => {
        this.player.play();
        this.audioCtx.resume();
    }

    this.shadowRoot.querySelector("#pause").onclick = () => {
        this.player.pause();
    }

    this.shadowRoot.querySelector("#avance10").onclick = () => {
        this.player.currentTime += 10;
    }

    this.shadowRoot.querySelector("#recule10").onclick = () => {
        this.player.currentTime -= 10;
    }

    this.shadowRoot.querySelector("#stop").onclick = () => {
        this.player.pause();
        this.player.currentTime = 0;
    }

    this.shadowRoot.querySelector("#reload").onclick = () => {
        this.player.currentTime = 0;
    }

    this.shadowRoot.querySelector("#vitesseLecture").oninput = (event) => {
        this.player.playbackRate = parseFloat(event.target.value);
        console.log("vitesse =  " + this.player.playbackRate);
    }

    this.shadowRoot.querySelector("#progress").onchange = (event) => {
        this.player.currentTime = parseFloat(event.target.value);
    }

    this.player.ontimeupdate = (event) => {
        let progressSlider = this.shadowRoot.querySelector("#progress");
        progressSlider.max = this.player.duration;
        progressSlider.min = 0;
        progressSlider.value = this.player.currentTime;
    }
}

setVolume (volume) {
    if (volume < 0) volume = 0;
    if (volume > 1) volume = 0.99;
    this.shadowRoot.querySelector ("#volumeKnob").value = volume
}

switchVolume () { this.audioComponent.setVolume (this.shadowRoot.querySelector ("#volumeKnob").value) }

    // L'API du Web Component

}

customElements.define("my-player", MyAudioPlayer);

