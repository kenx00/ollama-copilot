(function () {
  // Immediately log the document readiness
  console.log('Chat.js loaded, document.readyState:', document.readyState);
  
  // Add global error handler
  window.onerror = function(message, source, lineno, colno, error) {
    console.error('JavaScript error:', message);
    console.error('Error details:', {source, lineno, colno});
    console.error('Error object:', error);
    return false;
  };
  
  // Get VS Code API
  const vscode = acquireVsCodeApi();
  
  // Security utility functions
  
  /**
   * Escapes HTML special characters to prevent XSS
   */
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };
    
    return String(text).replace(/[&<>"'`=\/]/g, (char) => map[char]);
  }
  
  /**
   * Sanitizes language identifier for code blocks
   */
  function sanitizeLanguage(language) {
    // Only allow alphanumeric characters, hyphens, and underscores
    return String(language).replace(/[^a-zA-Z0-9_-]/g, '');
  }
  
  /**
   * Creates a safe code block element
   */
  function createSafeCodeBlock(code, language) {
    const pre = document.createElement('pre');
    const codeElement = document.createElement('code');
    
    if (language) {
      const sanitizedLang = sanitizeLanguage(language);
      if (sanitizedLang) {
        codeElement.className = `language-${sanitizedLang}`;
      }
    }
    
    // Use textContent to prevent any HTML interpretation
    codeElement.textContent = code;
    pre.appendChild(codeElement);
    
    return pre;
  }
  
  /**
   * Creates a safe inline code element
   */
  function createSafeInlineCode(code) {
    const codeElement = document.createElement('code');
    codeElement.textContent = code;
    return codeElement;
  }
  
  /**
   * Renders markdown-like content safely using DOM methods
   */
  function renderMarkdownSafely(content, container) {
    // Clear the container
    container.innerHTML = '';
    
    // Split content by code blocks first
    const parts = content.split(/(```[a-z]*\n[\s\S]*?```)/g);
    
    parts.forEach(part => {
      if (part.startsWith('```')) {
        // Handle code block
        const match = part.match(/```([a-z]*)\n([\s\S]*?)```/);
        if (match) {
          const language = match[1];
          const code = match[2];
          container.appendChild(createSafeCodeBlock(code, language));
        }
      } else {
        // Handle regular text with inline code
        const inlineParts = part.split(/(`[^`]+`)/g);
        
        inlineParts.forEach(inlinePart => {
          if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
            // Inline code
            const code = inlinePart.slice(1, -1);
            container.appendChild(createSafeInlineCode(code));
          } else {
            // Regular text - create text nodes
            const lines = inlinePart.split('\n');
            lines.forEach((line, index) => {
              if (line) {
                const textNode = document.createTextNode(line);
                container.appendChild(textNode);
              }
              if (index < lines.length - 1) {
                container.appendChild(document.createElement('br'));
              }
            });
          }
        });
      }
    });
  }
  
  /**
   * Sanitizes and validates model names
   */
  function sanitizeModelName(modelName) {
    // Only allow safe characters for model names
    return String(modelName).replace(/[^a-zA-Z0-9_\-.:]/g, '');
  }
  
  /**
   * Creates a safe option element
   */
  function createSafeOption(value, text, title, selected) {
    const option = document.createElement('option');
    option.value = sanitizeModelName(value);
    option.textContent = text; // textContent is safe
    if (title) {
      option.title = escapeHtml(title);
    }
    if (selected) {
      option.selected = true;
    }
    return option;
  }
  
  /**
   * Creates a safe list item for context files
   */
  function createSafeFileListItem(fileName, index, onRemove) {
    const li = document.createElement('li');
    
    // Use textContent for safe text insertion
    li.textContent = fileName;
    
    const removeBtn = document.createElement('span');
    removeBtn.textContent = '×';
    removeBtn.className = 'context-file-remove';
    removeBtn.addEventListener('click', onRemove);
    
    li.appendChild(removeBtn);
    return li;
  }
  
  // Log when the document is ready
  function checkElementsExist() {
    console.log('Checking DOM elements...');
    const elements = {
      'model-select': document.getElementById('model-select'),
      'add-file-btn': document.getElementById('add-file-btn'),
      'select-code-btn': document.getElementById('select-code-btn'),
      'use-workspace': document.getElementById('use-workspace'),
      'context-files-list': document.getElementById('context-files-list'),
      'chat-messages': document.getElementById('chat-messages'),
      'message-input': document.getElementById('message-input'),
      'send-button': document.getElementById('send-button'),
      'new-chat-btn': document.getElementById('new-chat-btn'),
    };
    
    // Log each element status
    for (const [id, element] of Object.entries(elements)) {
      console.log(`Element #${id}: ${element ? 'Found' : 'NOT FOUND'}`);
    }
  }
  
  // Check elements as soon as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkElementsExist);
  } else {
    checkElementsExist();
  }
  
  // Elements - declare variables that will be initialized when DOM is ready
  let modelSelect;
  let addFileBtn;
  let selectCodeBtn;
  let useWorkspaceCheckbox;
  let contextFilesList;
  let chatMessages;
  let messageInput;
  let sendButton;
  let newChatBtn;
  
  // Initialize elements once DOM is ready
  function initializeElements() {
    modelSelect = document.getElementById('model-select');
    addFileBtn = document.getElementById('add-file-btn');
    selectCodeBtn = document.getElementById('select-code-btn');
    useWorkspaceCheckbox = document.getElementById('use-workspace');
    contextFilesList = document.getElementById('context-files-list');
    chatMessages = document.getElementById('chat-messages');
    messageInput = document.getElementById('message-input');
    sendButton = document.getElementById('send-button');
    newChatBtn = document.getElementById('new-chat-btn');
    
    console.log('Elements initialized:', {
      modelSelect, addFileBtn, selectCodeBtn, useWorkspaceCheckbox,
      contextFilesList, chatMessages, messageInput, sendButton, newChatBtn
    });
    
    // Now that elements are initialized, set up event listeners
    setupEventListeners();
  }
  
  // Set up event listeners for UI elements
  function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Check if elements exist
    if (!modelSelect || !newChatBtn || !addFileBtn || !selectCodeBtn || 
        !sendButton || !messageInput || !useWorkspaceCheckbox) {
      console.error('Not all UI elements found. Cannot set up event listeners properly.');
      console.log('Elements status:', {
        modelSelect: !!modelSelect,
        newChatBtn: !!newChatBtn,
        addFileBtn: !!addFileBtn,
        selectCodeBtn: !!selectCodeBtn,
        sendButton: !!sendButton,
        messageInput: !!messageInput,
        useWorkspaceCheckbox: !!useWorkspaceCheckbox
      });
      return;
    }
  
    // Handle model selection
    modelSelect.addEventListener('change', () => {
      vscode.postMessage({
        type: 'selectModel',
        model: sanitizeModelName(modelSelect.value)
      });
    });
    
    // Handle new chat button
    newChatBtn.addEventListener('click', () => {
      console.log('New chat button clicked');
      vscode.postMessage({ type: 'newChat' });
    });
    
    // Handle add file button
    addFileBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'addFileContext' });
    });
    
    // Handle select code button
    selectCodeBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'selectCodeForContext' });
    });
    
    // Handle send button
    sendButton.addEventListener('click', (e) => {
      console.log('Send button clicked');
      e.preventDefault(); // Prevent any default form submission
      sendMessage();
    });
    
    // Handle enter key in message input
    messageInput.addEventListener('keydown', (e) => {
      console.log('Key pressed in message input:', e.key);
      if (e.key === 'Enter' && !e.shiftKey) {
        console.log('Enter key pressed (without shift)');
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  // State
  let contextFiles = [];
  let isLoading = false;
  
  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded, initializing chat UI');
    
    // Wait for a brief moment to ensure the DOM is fully rendered
    setTimeout(() => {
      // Initialize DOM elements
      initializeElements();
      
      // Check if elements were found
      console.log('Model select element:', modelSelect);
      console.log('Chat messages element:', chatMessages);
      console.log('Send button element:', sendButton);
      console.log('Message input element:', messageInput);
      
      // Test clicking the send button programmatically
      if (sendButton) {
        console.log('Adding a test click handler to the send button');
        sendButton.onclick = function(e) {
          console.log('Send button clicked via onclick property');
          sendMessage();
        };
        
        // Add a direct event listener as a backup approach
        document.getElementById('send-button')?.addEventListener('click', function(e) {
          console.log('Send button clicked via direct getElementById');
          sendMessage();
        });
      }
      
      // Restore any previous state
      const state = vscode.getState() || { messages: [] };
      
      // Render messages from state
      if (state.messages) {
        state.messages.forEach(message => {
          addMessageToUI(message.role, message.content);
        });
      }
      
      // Restore context files if any
      if (state.contextFiles) {
        contextFiles = state.contextFiles;
        updateContextFilesUI();
      }
      
      // Request model information directly after initialization
      console.log('Requesting models from extension...');
      vscode.postMessage({
        type: 'requestModels'
      });
    }, 100); // 100ms delay to ensure DOM is ready
  });
  
  // Send a message
  function sendMessage() {
    // Check if all required elements exist
    if (!messageInput || !useWorkspaceCheckbox) {
      console.error('Required elements missing for message sending');
      
      // Try to re-initialize elements
      initializeElements();
      
      if (!messageInput || !useWorkspaceCheckbox) {
        console.error('Failed to initialize required elements for sending message');
        return;
      }
    }
    
    const text = messageInput.value.trim();
    if (!text || isLoading) return;
    
    console.log('Sending message:', text);
    console.log('Context files:', contextFiles);
    console.log('Use workspace:', useWorkspaceCheckbox.checked);
    
    vscode.postMessage({
      type: 'sendMessage',
      text,
      contextFiles,
      useWorkspace: useWorkspaceCheckbox.checked
    });
    
    // Clear input
    messageInput.value = '';
  }
  
  // Update the UI with context files
  function updateContextFilesUI() {
    // Clear the list safely
    while (contextFilesList.firstChild) {
      contextFilesList.removeChild(contextFilesList.firstChild);
    }
    
    if (contextFiles.length === 0) {
      return;
    }
    
    contextFiles.forEach((file, index) => {
      const fileName = file.split('/').pop();
      const li = createSafeFileListItem(fileName, index, () => {
        contextFiles.splice(index, 1);
        updateContextFilesUI();
        updateState();
      });
      contextFilesList.appendChild(li);
    });
    
    updateState();
  }
  
  // Show loading indicator
  function showLoading(loading) {
    console.log('Setting loading state to:', loading);
    isLoading = loading;
    
    if (loading) {
        // Check if loading indicator already exists
        let loadingDiv = document.getElementById('loading-indicator');
        if (loadingDiv) {
            console.log('Loading indicator already exists, making sure it is visible');
            loadingDiv.style.display = 'flex';
            return;
        }
        
        console.log('Creating loading indicator');
        loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-indicator';
        loadingDiv.id = 'loading-indicator';
        loadingDiv.style.display = 'flex';
        
        // Create header container
        const headerDiv = document.createElement('div');
        headerDiv.className = 'loading-indicator-header';
        
        // Create left side of header (spinner, text)
        const leftDiv = document.createElement('div');
        leftDiv.className = 'loading-indicator-left';
        
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        
        const text = document.createElement('span');
        text.textContent = 'Thinking...';
        
        leftDiv.appendChild(spinner);
        leftDiv.appendChild(text);
        
        // Create right side with stop button
        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        stopButton.className = 'stop-button';
        stopButton.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Stop generation button clicked in chat.js');
            vscode.postMessage({
                type: 'stopGeneration'
            });
        });
        
        // Add left and right sides to header
        headerDiv.appendChild(leftDiv);
        headerDiv.appendChild(stopButton);
        
        // Add header to loading indicator
        loadingDiv.appendChild(headerDiv);
        
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Disable input while loading
        messageInput.disabled = true;
        sendButton.disabled = true;
    } else {
        console.log('Removing loading indicator');
        // Remove loading indicator
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        // Enable input
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
  }
  
  // Update streaming message with new content
  function updateStreamingMessage(content) {
    console.log('Updating streaming message with content length:', content.length);
    
    // Update both the streaming message and the loading content
    let streamingMessage = document.getElementById('streaming-message');
    const loadingContent = document.getElementById('loading-content');
    
    if (!content || content.trim() === '') {
      console.log('Empty content received, skipping update');
      return;
    }
    
    // Update streaming message if it exists
    if (streamingMessage) {
      console.log('Updating streaming message element');
      // Clear and re-render safely
      renderMarkdownSafely(content, streamingMessage);
    } else {
      console.log('Streaming message element not found, creating it');
      // Try to recreate it if it doesn't exist
      streamingMessage = document.createElement('div');
      streamingMessage.className = 'chat-message assistant streaming';
      streamingMessage.id = 'streaming-message';
      renderMarkdownSafely(content, streamingMessage);
      chatMessages.appendChild(streamingMessage);
      console.log('Created new streaming message element');
    }
    
    // Update loading content if it exists
    if (loadingContent) {
      console.log('Updating loading content element');
      renderMarkdownSafely(content, loadingContent);
      
      // Make sure the loading indicator is visible
      const loadingIndicator = document.getElementById('loading-indicator');
      if (loadingIndicator) {
        // Make sure it's visible
        loadingIndicator.style.display = 'flex';
        // Always make sure it's showing the content by removing collapsed state
        loadingIndicator.classList.remove('collapsed');
      }
    } else {
      console.log('Loading content element not found, creating loading indicator');
      // If loadingContent doesn't exist but should, create the loading indicator
      showLoading(true);
    }
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // Show an error message
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message; // textContent is safe
    
    chatMessages.appendChild(errorDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      errorDiv.style.opacity = '0';
      setTimeout(() => errorDiv.remove(), 500);
    }, 5000);
  }
  
  // Update the state
  function updateState() {
    const messages = Array.from(chatMessages.children)
      .filter(el => el.classList.contains('chat-message'))
      .map(el => {
        // Store the text content, not innerHTML
        return {
          role: el.classList.contains('user') ? 'user' : 'assistant',
          content: el.textContent || ''
        };
      });
    
    vscode.setState({ messages, contextFiles });
  }
  
  // Handle messages from the extension
  window.addEventListener('message', (event) => {
    const message = event.data;
    console.log('Received message from extension:', message.type, message);
    
    // Check if elements are initialized
    if (!modelSelect) {
      console.error('Elements not initialized when handling message:', message.type);
      // Try to initialize elements if they haven't been initialized yet
      initializeElements();
    }
    
    switch (message.type) {
      case 'updateModelInfo':
        // Populate model selection dropdown
        console.log('Received models:', message.payload?.models);
        console.log('Selected model:', message.payload?.selectedModel);
        
        // Check if modelSelect exists
        if (!modelSelect) {
          console.error('Model select element not found!');
          const foundModelSelect = document.getElementById('model-select');
          console.log('Attempted to find model-select again:', foundModelSelect);
        } else {
          console.log('Model select element found:', modelSelect);
        }
        
        // Clear options safely
        while (modelSelect.firstChild) {
          modelSelect.removeChild(modelSelect.firstChild);
        }
        
        // Check if models array exists and has items
        if (!message.payload?.models || !Array.isArray(message.payload.models) || message.payload.models.length === 0) {
          console.error('No models received or invalid format!', message.payload?.models);
          
          // Add a placeholder option
          const placeholderOption = createSafeOption('', 'No models available', '', false);
          placeholderOption.disabled = true;
          placeholderOption.selected = true;
          modelSelect.appendChild(placeholderOption);
        } else {
          // Models array exists, try to add options
          try {
            message.payload.models.forEach((model, index) => {
              console.log(`Adding model ${index}:`, model);
              const option = createSafeOption(
                model.name || model.label,
                model.name || model.label,
                model.details,
                (model.name || model.label) === message.payload.selectedModel
              );
              modelSelect.appendChild(option);
            });
            
            // Log the HTML content after population
            console.log('Model select HTML after population:', modelSelect.innerHTML);
            console.log('Number of options added:', modelSelect.options.length);
          } catch (error) {
            console.error('Error populating model dropdown:', error);
          }
        }
        break;
        
      case 'addMessage':
        addMessageToUI(message.payload?.role || message.role, message.payload?.content || message.content);
        break;
        
      case 'streamContent':
        const content = message.payload?.content || message.content;
        console.log('Received streamContent message with content length:', content ? content.length : 0);
        if (content) {
          updateStreamingMessage(content);
        } else {
          console.error('Received empty content in streamContent message');
        }
        break;
        
      case 'streamComplete':
        console.log('Received streamComplete message');
        // When streaming is complete, convert the streaming message to a regular message
        const streamingMessageComplete = document.getElementById('streaming-message');
        if (streamingMessageComplete) {
          console.log('Found streaming message element, converting to regular message');
          streamingMessageComplete.id = '';
          streamingMessageComplete.classList.remove('streaming');
        } else {
          console.error('Streaming message element not found on streamComplete');
        }
        
        // Also remove the loading indicator
        const loadingIndicatorComplete = document.getElementById('loading-indicator');
        if (loadingIndicatorComplete) {
          console.log('Removing loading indicator on streamComplete');
          loadingIndicatorComplete.remove();
        }
        
        updateState();
        break;
        
      case 'generationCancelled':
        // Handle when generation is cancelled by user
        console.log('Received generationCancelled message');
        const cancelledMessage = document.createElement('div');
        cancelledMessage.className = 'cancelled-message';
        cancelledMessage.textContent = '--- Generation cancelled by user ---';
        chatMessages.appendChild(cancelledMessage);
        
        // Remove the loading indicator if it exists
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
          console.log('Removing loading indicator on generationCancelled');
          loadingIndicator.remove();
        } else {
          console.log('No loading indicator found to remove on generationCancelled');
        }
        
        // Keep the streaming message but mark it as cancelled
        const streamingMessageCancelled = document.getElementById('streaming-message');
        if (streamingMessageCancelled) {
          console.log('Marking streaming message as cancelled');
          streamingMessageCancelled.classList.add('cancelled');
          streamingMessageCancelled.id = ''; // Remove the id so it's not affected by future updates
        } else {
          console.log('No streaming message found to mark as cancelled');
        }
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
        updateState();
        break;
        
      case 'updateContextFiles':
        contextFiles = message.payload?.files || message.files;
        updateContextFilesUI();
        break;
        
      case 'addCodeSelection':
        // Safely add code selection
        const fileName = message.payload?.fileName || message.fileName;
        const code = message.payload?.code || message.code;
        const codeContext = `Selected code from ${escapeHtml(fileName)}:\n\`\`\`\n${code}\n\`\`\``;
        messageInput.value = messageInput.value ? `${messageInput.value}\n\n${codeContext}` : codeContext;
        messageInput.focus();
        break;
        
      case 'setLoading':
        const loading = message.payload?.loading !== undefined ? message.payload.loading : message.loading;
        console.log('Received setLoading message:', loading);
        showLoading(loading);
        break;
        
      case 'showError':
        showError(message.payload?.message || message.message);
        break;
        
      case 'clearChat':
        // Clear chat messages safely
        if (chatMessages) {
          while (chatMessages.firstChild) {
            chatMessages.removeChild(chatMessages.firstChild);
          }
        }
        // Clear input
        if (messageInput) {
          messageInput.value = '';
        }
        // Clear context files safely
        if (contextFilesList) {
          while (contextFilesList.firstChild) {
            contextFilesList.removeChild(contextFilesList.firstChild);
          }
        }
        // Reset workspace checkbox
        if (useWorkspaceCheckbox) {
          useWorkspaceCheckbox.checked = false;
        }
        break;
    }
  });
  
  // Add a message to the UI
  function addMessageToUI(role, content) {
    // Remove any existing loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    // Render content safely
    renderMarkdownSafely(content, messageDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Update state
    updateState();
  }
  
})(); 