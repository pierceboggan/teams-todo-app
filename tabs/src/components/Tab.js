// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import React from 'react';
import axios from 'axios';
import './App.css';
import './Tab.css'
import {
  TeamsUserCredential,
  createMicrosoftGraphClient,
  loadConfiguration,
  getResourceConfiguration,
  ResourceType
} from "teamsdev-client";
import Profile from "./Profile";
import { Checkbox, Dropdown, getContext, Input, PrimaryButton, TeamsThemeContext, ThemeStyle } from 'msteams-ui-components-react';
import noItemimage from '../images/no-item.png'

class Tab extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      userInfo: {},
      profile: {},
      items: [],
      newItemDescription: "",
      showLoginPage: false,
      photoObjectURL: "",
      isAddingItem: false,
      initialized: false
    }
  }

  async componentDidMount() {
    await this.initTeamsFx();
    await this.getData();
    this.setState({
      initialized: true
    });
  }

  async initTeamsFx() {
    loadConfiguration({
      authentication: {
        initiateLoginEndpoint: process.env.REACT_APP_START_LOGIN_PAGE_URL,
        simpleAuthEndpoint: process.env.REACT_APP_TEAMSFX_ENDPOINT,
        clientId: process.env.REACT_APP_CLIENT_ID
      },
      resources: [
        {
          type: ResourceType.API,
          name: "default",
          properties: {
            endpoint: process.env.REACT_APP_FUNC_ENDPOINT
          }
        }
      ]
    });
    const credential = new TeamsUserCredential();
    const userInfo = await credential.getUserInfo();

    this.setState({
      userInfo: userInfo
    });

    this.credential = credential;
    this.scope = ["User.Read"];
  }

  async getData() {
    await this.getGraphProfile();
    await this.getItems();
  }

  async loginBtnClick() {
    try {
      await this.credential.login(this.scope);
    } catch (err) {
      alert("Login failed: " + err);
      return;
    }
    await this.getData();
  }

  async getGraphProfile() {
    try {
      var graphClient = await createMicrosoftGraphClient(this.credential, this.scope);
      var profile = await graphClient.api("/me").get();

      this.setState({
        profile: profile,
        showLoginPage: false,
      });
    } catch (err) {
      this.setState({
        showLoginPage: true
      });
    }
  }

  async callFunctionWithErrorHandling(command, method, options) {
    var message = [];
    var funcErrorMsg = "";
    try {
      const accessToken = await this.credential.getToken(""); // Get SSO token for the user
      const apiConfig = getResourceConfiguration(ResourceType.API);
      const response = await axios.default.request({
        method: method,
        url: apiConfig.endpoint + "/api/" + command,
        headers: {
          authorization: "Bearer " + accessToken.token
        },
        data: options
      });
      message = response.data;
    } catch (err) {
      if (err.response && err.response.status && err.response.status === 404) {
        funcErrorMsg =
          'There may be a problem with the deployment of Azure Function App, please deploy Azure Function (Run command palette "TeamsFx - Deploy Package") first before running this App';
      } else if (err.message === "Network Error") {
        funcErrorMsg =
          "Cannot call Azure Function due to network error, please check your network connection status and ";
        if (err.config.url.indexOf("localhost") >= 0) {
          funcErrorMsg +=
            'make sure to start Azure Function locally (Run "npm run start" command inside api folder from terminal) first before running this App';
        } else {
          funcErrorMsg +=
            'make sure to provision and deploy Azure Function (Run command palette "TeamsFx - Provision Resource" and "TeamsFx - Deploy Package") first before running this App';
        }
      } else {
        funcErrorMsg = err.toString();
        if (err.response?.data?.error) {
          funcErrorMsg += ": " + err.response.data.error;
        }
        alert(funcErrorMsg);
      }
    }
    return message;
  }

  async getItems() {
    // Use client TeamsFx SDK to call "todo" Azure Function in "get" method to get all todo list which belong to user oid
    let result = await this.callFunctionWithErrorHandling("todo", "get");
    if ("Error" === result) {
      throw new Error("todo Function failed, please check Azure Functions log for details!");
    } else {
      this.setState({
        items: result
      });
    }
  }

  async onAddItem() {
    const newItems = JSON.parse(JSON.stringify(this.state.items));
    newItems.push({
      description: this.state.newItemDescription
    })
    this.setState({
      newItemDescription: "",
      items: newItems
    });

    // Use client TeamsFx SDK to call "todo" Azure Function in "post" method to insert a new todo item under user oid
    await this.callFunctionWithErrorHandling("todo", "post", {
      description: this.state.newItemDescription, isCompleted: false
    });
    this.refresh();
  }

  async onUpdateItem(id, description) {
    // Use client TeamsFx SDK to call "todo" Azure Function in "put" method to update a todo item
    await this.callFunctionWithErrorHandling("todo", "put", { id, description });
  }

  async onDeleteItem(id) {
    // Use client TeamsFx SDK to call "todo" Azure Function in "delete" method to delete a todo item
    await this.callFunctionWithErrorHandling("todo", "delete", { id });
    this.refresh();
  }

  async onCompletionStatusChange(id, index, isCompleted) {
    this.handleInputChange(index, "isCompleted", isCompleted);
    // Use client TeamsFx SDK to call "todo" Azure Function in "put" method to update a todo item to completed
    await this.callFunctionWithErrorHandling("todo", "put", { id, isCompleted });
  }

  handleInputChange(index, property, value) {
    const newItems = JSON.parse(JSON.stringify(this.state.items))
    newItems[index][property] = value;
    this.setState({
      items: newItems
    })
  }

  async refresh() {
    await this.getItems();
  }

  render() {
    const context = getContext({
      baseFontSize: 16,
      style: ThemeStyle.Light
    });

    const items = this.state.items?.map((item, index) =>
      <div key={item.id} className="item">
        <div className="complete">
          <Checkbox
            checked={this.state.items[index].isCompleted}
            onChecked={(checked) => this.onCompletionStatusChange(item.id, index, checked)}
            className="is-completed-input"
          />
        </div>
        <div className="description">
          <Input
            value={this.state.items[index].description}
            onChange={(e) => this.handleInputChange(index, "description", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                this.onUpdateItem(item.id, this.state.items[index].description);
                e.target.blur();
              }
            }}
            onBlur={() => this.onUpdateItem(item.id, this.state.items[index].description)}
            className={"text" + (this.state.items[index].isCompleted ? " is-completed" : "")}
          />
        </div>
        {index < 2 && <div className="flag">
          <svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M0 1.49805C0 1.22191 0.22386 0.998047 0.5 0.998047H11.5027C11.9148 0.998047 12.15 1.46848 11.9027 1.79809L9.12653 5.49886L11.9027 9.19967C12.15 9.52927 11.9148 9.99967 11.5027 9.99967L1 9.9994V13.1659C1 13.4191 0.8119 13.6283 0.567847 13.6614L0.5 13.6659C0.246867 13.6659 0.0376733 13.4778 0.00456667 13.2338L0 13.1659V1.49805Z" fill="#D83B01" /> </svg>
        </div>
        }
        <div className="action">

          <Dropdown
            mainButtonText="..."
            items={[
              {
                text: 'Delete',
                onClick: () => this.onDeleteItem(item.id)
              }
            ]}
            className="action-dropdown"
          />
        </div>
      </div>
    );

    return (
      <TeamsThemeContext.Provider value={context}>
        <div>
          {!this.state.showLoginPage && this.state.initialized && <div>
            <div className="toolbar">

              <div className="t1">
                <svg width="16" height="11" viewBox="0 0 16 11" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M0 0.5C0 0.223858 0.223858 0 0.5 0H15.5C15.7761 0 16 0.223858 16 0.5C16 0.776142 15.7761 1 15.5 1H0.5C0.223858 1 0 0.776142 0 0.5Z" fill="#6264A7" /> <path d="M0 5.5C0 5.22386 0.223858 5 0.5 5H15.5C15.7761 5 16 5.22386 16 5.5C16 5.77614 15.7761 6 15.5 6H0.5C0.223858 6 0 5.77614 0 5.5Z" fill="#6264A7" /> <path d="M0.5 10C0.223858 10 0 10.2239 0 10.5C0 10.7761 0.223858 11 0.5 11H15.5C15.7761 11 16 10.7761 16 10.5C16 10.2239 15.7761 10 15.5 10H0.5Z" fill="#6264A7" /> </svg>
              </div>

              <div className="t2">
                <svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 6.992V8H7V14H6.008V8H0.00800002V6.992H6.008V0.992H7V6.992H13Z" fill="#242424" />
                </svg>
              </div>

              <div className="t3">Add section</div>

              <div className="t4">
                <svg width="14" height="9" viewBox="0 0 14 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.5 8H9.5C9.77614 8 10 8.22386 10 8.5C10 8.74546 9.82312 8.94961 9.58988 8.99194L9.5 9H4.5C4.22386 9 4 8.77614 4 8.5C4 8.25454 4.17688 8.05039 4.41012 8.00806L4.5 8H9.5H4.5ZM2.5 4H11.5C11.7761 4 12 4.22386 12 4.5C12 4.74546 11.8231 4.94961 11.5899 4.99194L11.5 5H2.5C2.22386 5 2 4.77614 2 4.5C2 4.25454 2.17688 4.05039 2.41012 4.00806L2.5 4H11.5H2.5ZM0.5 0H13.5C13.7761 0 14 0.223858 14 0.5C14 0.74546 13.8231 0.949608 13.5899 0.991944L13.5 1H0.5C0.223858 1 0 0.776142 0 0.5C0 0.25454 0.176875 0.0503916 0.410124 0.00805569L0.5 0H13.5H0.5Z" fill="#212121" />
                </svg>

              </div>

              <div className="t5">Filter</div>

              <div className="t6">
                <svg width="210" height="32" viewBox="0 0 210 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="210" height="32" rx="3" fill="white" />
                  <path d="M18.2617 13.2363H14.4336V16.627H17.9746V17.6592H14.4336V22H13.2852V12.1973H18.2617V13.2363ZM20.5449 13.2227C20.3444 13.2227 20.1735 13.1543 20.0322 13.0176C19.891 12.8809 19.8203 12.7077 19.8203 12.498C19.8203 12.2884 19.891 12.1152 20.0322 11.9785C20.1735 11.8372 20.3444 11.7666 20.5449 11.7666C20.75 11.7666 20.9232 11.8372 21.0645 11.9785C21.2103 12.1152 21.2832 12.2884 21.2832 12.498C21.2832 12.6986 21.2103 12.8695 21.0645 13.0107C20.9232 13.152 20.75 13.2227 20.5449 13.2227ZM21.0918 22H19.9707V15H21.0918V22ZM29.1719 22H28.0508V18.0078C28.0508 16.5221 27.5085 15.7793 26.4238 15.7793C25.8633 15.7793 25.3984 15.9912 25.0293 16.415C24.6647 16.8343 24.4824 17.3652 24.4824 18.0078V22H23.3613V15H24.4824V16.1621H24.5098C25.0384 15.278 25.804 14.8359 26.8066 14.8359C27.5723 14.8359 28.1579 15.0843 28.5635 15.5811C28.9691 16.0732 29.1719 16.7865 29.1719 17.7207V22ZM37.2656 22H36.1445V20.8105H36.1172C35.5977 21.7129 34.7956 22.1641 33.7109 22.1641C32.8314 22.1641 32.1273 21.8519 31.5986 21.2275C31.0745 20.5986 30.8125 19.7441 30.8125 18.6641C30.8125 17.5065 31.1042 16.5791 31.6875 15.8818C32.2708 15.1846 33.0479 14.8359 34.0186 14.8359C34.9801 14.8359 35.6797 15.2142 36.1172 15.9707H36.1445V11.6367H37.2656V22ZM36.1445 18.835V17.8027C36.1445 17.2376 35.9577 16.7591 35.584 16.3672C35.2103 15.9753 34.7363 15.7793 34.1621 15.7793C33.4785 15.7793 32.9408 16.0299 32.5488 16.5312C32.1569 17.0326 31.9609 17.7253 31.9609 18.6094C31.9609 19.416 32.1478 20.054 32.5215 20.5234C32.8997 20.9883 33.4056 21.2207 34.0391 21.2207C34.6634 21.2207 35.1693 20.9951 35.5566 20.5439C35.9486 20.0928 36.1445 19.5231 36.1445 18.835Z" fill="#616161" />
                  <path d="M197.352 22.6484L192.641 17.9375C193.062 17.4323 193.393 16.8672 193.633 16.2422C193.878 15.612 194 14.9479 194 14.25C194 13.724 193.93 13.2188 193.789 12.7344C193.654 12.2448 193.461 11.7865 193.211 11.3594C192.961 10.9323 192.659 10.5443 192.305 10.1953C191.956 9.84115 191.568 9.53906 191.141 9.28906C190.714 9.03906 190.255 8.84635 189.766 8.71094C189.281 8.57031 188.776 8.5 188.25 8.5C187.464 8.5 186.721 8.65365 186.023 8.96094C185.331 9.26302 184.721 9.67708 184.195 10.2031C183.674 10.724 183.26 11.3333 182.953 12.0312C182.651 12.724 182.5 13.4635 182.5 14.25C182.5 14.7708 182.568 15.276 182.703 15.7656C182.844 16.25 183.039 16.7057 183.289 17.1328C183.544 17.5547 183.849 17.9427 184.203 18.2969C184.557 18.651 184.945 18.9557 185.367 19.2109C185.794 19.4609 186.25 19.6562 186.734 19.7969C187.224 19.9323 187.729 20 188.25 20C188.948 20 189.609 19.8802 190.234 19.6406C190.865 19.3958 191.432 19.0625 191.938 18.6406L196.648 23.3516C196.747 23.4505 196.865 23.5 197 23.5C197.135 23.5 197.253 23.4505 197.352 23.3516C197.451 23.2526 197.5 23.1354 197.5 23C197.5 22.8646 197.451 22.7474 197.352 22.6484ZM183.5 14.25C183.5 13.6042 183.625 12.9948 183.875 12.4219C184.13 11.8438 184.474 11.3385 184.906 10.9062C185.339 10.474 185.841 10.1328 186.414 9.88281C186.992 9.6276 187.604 9.5 188.25 9.5C188.896 9.5 189.505 9.6276 190.078 9.88281C190.656 10.1328 191.161 10.474 191.594 10.9062C192.026 11.3385 192.367 11.8438 192.617 12.4219C192.872 12.9948 193 13.6042 193 14.25C193 14.8958 192.872 15.5078 192.617 16.0859C192.367 16.6589 192.026 17.1615 191.594 17.5938C191.161 18.026 190.656 18.3698 190.078 18.625C189.505 18.875 188.896 19 188.25 19C187.604 19 186.992 18.875 186.414 18.625C185.841 18.3698 185.339 18.026 184.906 17.5938C184.474 17.1615 184.13 16.6589 183.875 16.0859C183.625 15.5078 183.5 14.8958 183.5 14.25Z" fill="#252525" />
                </svg>
              </div>

            </div>

            <div className="flex-container">
              <div className="todo-list">
                <div className="time active">
                  <div className="time-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 4.16667C14 2.97005 13.0299 2 11.8333 2H4.16667C2.97005 2 2 2.97005 2 4.16667V11.8333C2 13.0299 2.97005 14 4.16667 14H6.83333C6.83333 14 6.83333 13.6789 6.83333 13.5V13H4.16667C3.52233 13 3 12.4777 3 11.8333V5.66667H13V11.8333C13 12.4777 12.4777 13 11.8333 13H9.16667V13.5C9.16667 13.6789 9.16667 14 9.16667 14H11.8333C13.0299 14 14 13.0299 14 11.8333V4.16667ZM4.16667 3H11.8333C12.4777 3 13 3.52233 13 4.16667V4.66667H3V4.16667C3 3.52233 3.52233 3 4.16667 3Z" fill="#484644" />
                      <path d="M8.83317 7.83333C8.83317 8.2936 8.4601 8.66667 7.99984 8.66667C7.53957 8.66667 7.1665 8.2936 7.1665 7.83333C7.1665 7.37307 7.53957 7 7.99984 7C8.4601 7 8.83317 7.37307 8.83317 7.83333Z" fill="#484644" />
                      <path d="M9.16784 12.2071C9.37424 12.3905 9.69024 12.3719 9.87371 12.1655C10.0572 11.9591 10.0386 11.643 9.83217 11.4596L8.33217 10.1262C8.14277 9.95792 7.85724 9.95792 7.66784 10.1262L6.16782 11.4596C5.96143 11.643 5.94284 11.9591 6.1263 12.1655C6.30976 12.3719 6.62579 12.3905 6.83217 12.2071L7.50004 11.6134V14.1666C7.50004 14.4428 7.72384 14.6666 8.00004 14.6666C8.27617 14.6666 8.50004 14.4428 8.50004 14.1666V11.6134L9.16784 12.2071Z" fill="#484644" />
                    </svg>
                  </div>
                  <div className="time-text">
                    Today ({this.state.items.length})
                  </div>
                </div>

                <div className="time">
                  <div className="time-icon">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9.83333 0C11.0299 0 12 0.970047 12 2.16667V9.83333C12 11.0299 11.0299 12 9.83333 12H2.16667C0.970047 12 0 11.0299 0 9.83333V2.16667C0 0.970047 0.970047 0 2.16667 0H9.83333ZM9.83333 1H2.16667C1.52233 1 1 1.52233 1 2.16667V9.83333C1 10.4777 1.52233 11 2.16667 11H9.83333C10.4777 11 11 10.4777 11 9.83333V2.16667C11 1.52233 10.4777 1 9.83333 1ZM8.83333 5.33333C9.10947 5.33333 9.33333 5.5572 9.33333 5.83333V8.83333C9.33333 9.10947 9.10947 9.33333 8.83333 9.33333H3.16667C2.89053 9.33333 2.66667 9.10947 2.66667 8.83333V5.83333C2.66667 5.5572 2.89053 5.33333 3.16667 5.33333H8.83333ZM8.33333 6.33333H3.66667V8.33333H8.33333V6.33333ZM3.16667 2.83333H8.83333C9.10947 2.83333 9.33333 3.05719 9.33333 3.33333C9.33333 3.58647 9.1452 3.79566 8.9012 3.82877L8.83333 3.83333H3.16667C2.89053 3.83333 2.66667 3.60947 2.66667 3.33333C2.66667 3.0802 2.85477 2.87101 3.09882 2.8379L3.16667 2.83333H8.83333H3.16667Z" fill="#A19F9D" />
                    </svg>
                  </div>
                  <div className="time-text">
                    Daily (4)
                </div>
                </div>

                <div className="time">
                  <div className="time-icon">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9.83333 0C11.0299 0 12 0.970047 12 2.16667V9.83333C12 11.0299 11.0299 12 9.83333 12H2.16667C0.970047 12 0 11.0299 0 9.83333V2.16667C0 0.970047 0.970047 0 2.16667 0H9.83333ZM9.83333 1H2.16667C1.52233 1 1 1.52233 1 2.16667V9.83333C1 10.4777 1.52233 11 2.16667 11H9.83333C10.4777 11 11 10.4777 11 9.83333V2.16667C11 1.52233 10.4777 1 9.83333 1ZM3.16667 2.66667C3.4198 2.66667 3.62899 2.85477 3.6621 3.09882L3.66667 3.16667V8.83333C3.66667 9.10947 3.44281 9.33333 3.16667 9.33333C2.91353 9.33333 2.70434 9.1452 2.67123 8.9012L2.66667 8.83333V3.16667C2.66667 2.89053 2.89053 2.66667 3.16667 2.66667Z" fill="#A19F9D" />
                    </svg>
                  </div>
                  <div className="time-text">
                    Weekly (12)
                </div>
                </div>

                <div className="time">
                  <div className="time-icon">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9.83333 0C11.0299 0 12 0.970047 12 2.16667V9.83333C12 11.0299 11.0299 12 9.83333 12H2.16667C0.970047 12 0 11.0299 0 9.83333V2.16667C0 0.970047 0.970047 0 2.16667 0H9.83333ZM9.83333 1H2.16667C1.52233 1 1 1.52233 1 2.16667V9.83333C1 10.4777 1.52233 11 2.16667 11H9.83333C10.4777 11 11 10.4777 11 9.83333V2.16667C11 1.52233 10.4777 1 9.83333 1ZM3.16667 7C3.62691 7 4 7.37307 4 7.83333C4 8.2936 3.62691 8.66667 3.16667 8.66667C2.70643 8.66667 2.33333 8.2936 2.33333 7.83333C2.33333 7.37307 2.70643 7 3.16667 7ZM6 7C6.46027 7 6.83333 7.37307 6.83333 7.83333C6.83333 8.2936 6.46027 8.66667 6 8.66667C5.53973 8.66667 5.16667 8.2936 5.16667 7.83333C5.16667 7.37307 5.53973 7 6 7ZM3.16667 3.66667C3.62691 3.66667 4 4.03976 4 4.5C4 4.96027 3.62691 5.33333 3.16667 5.33333C2.70643 5.33333 2.33333 4.96027 2.33333 4.5C2.33333 4.03976 2.70643 3.66667 3.16667 3.66667ZM6 3.66667C6.46027 3.66667 6.83333 4.03976 6.83333 4.5C6.83333 4.96027 6.46027 5.33333 6 5.33333C5.53973 5.33333 5.16667 4.96027 5.16667 4.5C5.16667 4.03976 5.53973 3.66667 6 3.66667ZM8.83333 3.66667C9.2936 3.66667 9.66667 4.03976 9.66667 4.5C9.66667 4.96027 9.2936 5.33333 8.83333 5.33333C8.37307 5.33333 8 4.96027 8 4.5C8 4.03976 8.37307 3.66667 8.83333 3.66667Z" fill="#A19F9D" />
                    </svg>

                  </div>
                  <div className="time-text">
                    Monthly (5)
                </div>
                </div>

                <div className="time">
                  <div className="time-icon">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 9.83333C12 11.0299 11.0299 12 9.83333 12H2.16667C0.970047 12 0 11.0299 0 9.83333V2.16667C0 0.970047 0.970047 0 2.16667 0H9.83333C11.0299 0 12 0.970047 12 2.16667V9.83333ZM11 9.83333V2.16667C11 1.52233 10.4777 1 9.83333 1H2.16667C1.52233 1 1 1.52233 1 2.16667V9.83333C1 10.4777 1.52233 11 2.16667 11H9.83333C10.4777 11 11 10.4777 11 9.83333ZM9.33333 3.16667C9.33333 3.4198 9.1452 3.62899 8.9012 3.6621L8.83333 3.66667H3.16667C2.89053 3.66667 2.66667 3.44281 2.66667 3.16667C2.66667 2.91353 2.85477 2.70434 3.09882 2.67123L3.16667 2.66667H8.83333C9.10947 2.66667 9.33333 2.89053 9.33333 3.16667ZM9.33333 8.83333C9.33333 9.08647 9.1452 9.29567 8.9012 9.3288L8.83333 9.33333H3.16667C2.89053 9.33333 2.66667 9.10947 2.66667 8.83333C2.66667 8.5802 2.85477 8.371 3.09882 8.33787L3.16667 8.33333H8.83333C9.10947 8.33333 9.33333 8.5572 9.33333 8.83333ZM9.33333 6C9.33333 6.25313 9.1452 6.46233 8.9012 6.49547L8.83333 6.5H3.16667C2.89053 6.5 2.66667 6.27613 2.66667 6C2.66667 5.74687 2.85477 5.53767 3.09882 5.50453L3.16667 5.5H8.83333C9.10947 5.5 9.33333 5.72387 9.33333 6Z" fill="#A19F9D" />
                    </svg>
                  </div>
                  <div className="time-text">
                    Yearly (3)
                </div>
                </div>

              </div>

              <div className="todo-col">
                <h2>Hello, {this.state.profile.displayName}</h2>
                <div className="todo">
                  <div className="header">
                    <div className="title-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 6.25C21 4.45507 19.5449 3 17.75 3H6.25C4.45507 3 3 4.45507 3 6.25V17.75C3 19.5449 4.45507 21 6.25 21H10.25C10.25 21 10.25 20.5184 10.25 20.25V19.5H6.25C5.2835 19.5 4.5 18.7165 4.5 17.75V8.5H19.5V17.75C19.5 18.7165 18.7165 19.5 17.75 19.5H13.75V20.25C13.75 20.5184 13.75 21 13.75 21H17.75C19.5449 21 21 19.5449 21 17.75V6.25ZM6.25 4.5H17.75C18.7165 4.5 19.5 5.2835 19.5 6.25V7H4.5V6.25C4.5 5.2835 5.2835 4.5 6.25 4.5Z" fill="#6264A7" />
                        <path d="M13.25 11.75C13.25 12.4404 12.6904 13 12 13C11.3096 13 10.75 12.4404 10.75 11.75C10.75 11.0596 11.3096 10.5 12 10.5C12.6904 10.5 13.25 11.0596 13.25 11.75Z" fill="#6264A7" />
                        <path d="M13.7518 18.3106C14.0614 18.5857 14.5354 18.5579 14.8106 18.2483C15.0858 17.9387 15.0579 17.4646 14.7483 17.1894L12.4983 15.1894C12.2142 14.9369 11.7859 14.9369 11.5018 15.1894L9.25173 17.1894C8.94215 17.4646 8.91426 17.9387 9.18945 18.2483C9.46464 18.5579 9.93869 18.5857 10.2483 18.3106L11.2501 17.4201V21.25C11.2501 21.6642 11.5858 22 12.0001 22C12.4143 22 12.7501 21.6642 12.7501 21.25V17.4201L13.7518 18.3106Z" fill="#6264A7" />
                      </svg>
                    </div>
                    <div className="title">
                      Today ({this.state.items.length})
                  </div>
                    <div className="add-button">
                      <PrimaryButton onClick={() => this.setState({ isAddingItem: true })}>+ Add task</PrimaryButton>
                    </div>
                  </div>

                  <div className="items">
                    {items}

                    {this.state.isAddingItem && <div className="item add">
                      <div className="is-completed">
                        <Checkbox
                          disabled
                          className="is-completed-input"
                        />
                      </div>
                      <div className="description">
                        <Input
                          autoFocus
                          type="text"
                          value={this.state.newItemDescription}
                          onChange={(e) => this.setState({ newItemDescription: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              this.onAddItem();
                            }
                          }}
                          onBlur={() => {
                            if (this.state.newItemDescription) {
                              this.onAddItem();
                            }
                            this.setState({
                              isAddingItem: false,
                            });
                          }}
                          className="text"
                        />
                      </div>
                      <div className="action">
                        <Dropdown
                          mainButtonText="..."
                          disabled
                          items={[]}
                        />
                      </div>
                    </div>}

                    {this.state.initialized && !this.state.items.length && !this.state.isAddingItem && <div className="no-item">
                      <div>
                        <img src={noItemimage} alt="no item" />
                      </div>
                      <div>
                        <h2>No tasks</h2>
                        <p>Add more tasks to make you day productive.</p>
                      </div>
                    </div>}
                  </div>
                </div>
              </div>
            </div>
          </div>}

          {this.state.showLoginPage && <div className="auth">
            <Profile userInfo={this.state.userInfo} profile={this.state.profile} />
            <h2>Welcome to To Do List App!</h2>
            <PrimaryButton onClick={() => this.loginBtnClick()}>Start</PrimaryButton>
          </div>}
        </div>
      </TeamsThemeContext.Provider >
    );
  }
}
export default Tab;
