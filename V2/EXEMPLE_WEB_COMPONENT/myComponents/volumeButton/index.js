import '../libs/webaudio-controls.js';

const getBaseURL = () => {
    return new URL('.', import.meta.url);
};

const template = document.createElement("template");
template.innerHTML = /*html*/`
    <style>
    #volumeKnob{position: absolute;}
    </style>

    <webaudio-knob id="volumeKnob" 
      src="../assets/imgs/vernier.png" 
      value=5 min=0 max=20 step=0.01 
      diameter="100" 
      tooltip="Volume: %d">
    </webaudio-knob>
`;
const templatePlay = document.createElement ("template");


class VolumeButton extends HTMLElement{
    constructor() {
        super();

        this.attachShadow({ mode: "open" });

        this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.basePath = getBaseURL();
    }

    connectedCallback(){
        let volumeButton = this.shadowRoot.querySelector ("#volumeKnob")
        volumeButton.innerHTML = templatePlay.innerHTML

        // set range volume
        this.shadowRoot.querySelector ("#volumeKnob").oninput = () => this.switchVolume ()
    }

    init () {
        this.switchVolume ()
        this.switchVolume ()
    }

    setVolume (volume) {
        if (volume < 0) volume = 0;
        if (volume > 1) volume = 0.99;
        this.shadowRoot.querySelector ("#volumeKnob").value = volume
    }

    switchVolume () { this.audioComponent.setVolume (this.shadowRoot.querySelector ("#volumeKnob").value) }
}

customElements.define("volume-button", VolumeButton);