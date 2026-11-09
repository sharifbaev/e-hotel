import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ResultPopup } from './shared/ui/result-popup/result-popup';

@Component({
  imports: [RouterOutlet, ResultPopup],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
