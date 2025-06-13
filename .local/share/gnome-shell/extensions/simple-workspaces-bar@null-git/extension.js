/**
 * Workspaces Bar
 * Copyright Francois Thirioux 2021
 * GitHub contributors: @fthx, @null-git
 * License GPL v3
 */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Button} from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const WORKSPACES_SCHEMA = "org.gnome.desktop.wm.preferences";
const WORKSPACES_KEY = "workspace-names";

const SimpleWorkspacesBar = GObject.registerClass(
  class SimpleWorkspacesBar extends Button {
    /**
     * @param {number} menuAlignment
     * @param {string} nameText
     * @param {boolean | undefined} dontCreateMenu
     * @private
     */
    _init(menuAlignment, nameText, dontCreateMenu) {
      super._init(menuAlignment, nameText, dontCreateMenu);
      this.track_hover = false;

      // define gsettings schema for workspaces names, get workspaces names,
      // signal for settings key changed
      this.workspaces_settings = new Gio.Settings({schema: WORKSPACES_SCHEMA});
      this.workspaces_names_changed = this.workspaces_settings.connect(
        `changed::${WORKSPACES_KEY}`, this._update_workspaces_names.bind(this)
      );

      // hide Activities button
      this._show_activities(false);

      // bar creation
      this.ws_bar = new St.BoxLayout({});
      this._update_workspaces_names();
      this.add_child(this.ws_bar);

      // signals for workspaces state: active workspace, number of workspaces
      this._ws_active_changed = global.workspace_manager.connect(
        'active-workspace-changed', this._update_ws.bind(this)
      );
      this._ws_number_changed = global.workspace_manager.connect(
        'notify::n-workspaces', this._update_ws.bind(this)
      );
      this._restacked = global.display.connect(
        'restacked', this._update_ws.bind(this)
      );
      this._windows_changed = Shell.WindowTracker.get_default().connect(
        'tracked-windows-changed', this._update_ws.bind(this)
      );
    }

    /**
     * remove signals, restore Activities button, destroy workspaces bar
     * @public
     */
    _destroy() {
      this._show_activities(true);
      if (this._ws_active_changed) {
        global.workspace_manager.disconnect(this._ws_active_changed);
      }
      if (this._ws_number_changed) {
        global.workspace_manager.disconnect(this._ws_number_changed);
      }
      if (this._restacked) {
        global.display.disconnect(this._restacked);
      }
      if (this._windows_changed) {
        Shell.WindowTracker.get_default().disconnect(this._windows_changed);
      }
      if (this.workspaces_names_changed) {
        this.workspaces_settings.disconnect(this.workspaces_names_changed);
      }
      this.ws_bar.destroy();
      super.destroy();
    }

    /**
     * show or hide activities button
     * @param {boolean} show the activities button
     * @private
     */
    _show_activities(show) {
      this.activities_button = Main.panel.statusArea['activities'];
      if (this.activities_button) {
        if (show && !Main.sessionMode.isLocked) {
          this.activities_button.container.show();
        } else {
          this.activities_button.container.hide();
        }
      }
    }

    /**
     * update workspaces names
     * @private
     */
    _update_workspaces_names() {
      this.workspaces_names = this.workspaces_settings.get_strv(WORKSPACES_KEY);
      this._update_ws();
    }

    /**
     * get workspace button style class
     * @param {boolean} ws_active the workspace is selected
     * @param {boolean} ws_empty the workspace has no applications
     * @returns {string}
     * @private
     */
    _get_ws_button_style_class(ws_active, ws_empty) {
      return (
        `desktop-label desktop-label-${ws_empty ? '' : 'non'}empty-${ws_active ? '' : 'in'}active`
      );
    }

    /**
     * update the workspaces bar
     * @private
     */
    _update_ws() {
      // destroy old workspaces bar buttons
      this.ws_bar.destroy_all_children();

      // get number of workspaces
      this.ws_count = global.workspace_manager.get_n_workspaces();
      this.active_ws_index = global.workspace_manager.get_active_workspace_index();

      // display all current workspaces buttons
      for (let ws_index = 0; ws_index < this.ws_count; ++ws_index) {
        this.ws_box = new St.Bin(
          {visible: true, reactive: true, can_focus: true, track_hover: true}
        );
        const label = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        label.style_class = this._get_ws_button_style_class(
          ws_index === this.active_ws_index,
          global.workspace_manager.get_workspace_by_index(ws_index).n_windows <= 0,
        )
        label.set_text(`${this.workspaces_names[ws_index] ?? ws_index + 1}`);
        this.ws_box.set_child(label);
        this.ws_box.connect('button-release-event', () => this._toggle_ws(ws_index));
        this.ws_bar.add_child(this.ws_box);
      }
    }

    /**
     * activate workspace or show overview
     * @param {number} ws_index the workspaces' index
     * @private
     */
    _toggle_ws(ws_index) {
      if (global.workspace_manager.get_active_workspace_index() === ws_index) {
        Main.overview.toggle();
      } else {
        global.workspace_manager
          .get_workspace_by_index(ws_index)
          .activate(global.get_current_time());
      }
    }
  });

// noinspection JSUnusedGlobalSymbols
export default class SWBExtension extends Extension {
  enable() {
    this.workspaces_bar = new SimpleWorkspacesBar(0.0, 'Simple Workspaces Bar');
    Main.panel.addToStatusArea('simple-workspaces-bar', this.workspaces_bar, 1, 'left');
  }

  disable() {
    this.workspaces_bar._destroy();
    this.workspaces_bar = null;
  }
}
