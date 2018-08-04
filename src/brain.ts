// Brain is based on https://github.com/andrew-templeton/bottie

import * as Natural from 'natural';
import { NaturalGuess } from './types';

export class Brain {
    classifier: Natural.LogisticRegressionClassifier;
    minConfidence: number;

    constructor() {
        this.classifier = new Natural.LogisticRegressionClassifier();
        this.minConfidence = 0.7;
    }

    teach(samples: Array<string>, label: string) {
        samples.forEach((sample: string) => {
            this.classifier.addDocument(sample.toLowerCase(), label);
        })
    }

    train() {
        this.classifier.train();
    }

    interpret(sample: string) {
        let guesses = this.classifier.getClassifications(sample.toLowerCase()) as any as Array<NaturalGuess>;
        let guess = guesses.reduce((accum, newVal) => {
            return accum && accum.value > newVal.value ? accum : newVal;
        })

        return guess.value > this.minConfidence ? guess : { label: "error-unknown", value: 0 };
    };
}