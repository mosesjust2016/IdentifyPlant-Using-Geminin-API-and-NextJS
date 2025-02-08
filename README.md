# Plant Identifier

**Plant Identifier** is a modern Next.js web application that lets users upload a plant image and leverages Google Generative AI to identify the plant and provide comprehensive care information. The application extracts key details such as the common name, scientific name, care requirements, interesting facts, and warnings, displaying them in an easy-to-read format.

## Features

- **Image Upload:**  
  Easily upload an image of a plant from your device.

- **AI-Powered Identification:**  
  Uses Google Generative AI to analyze the image and generate detailed plant information.

- **Detailed Plant Information:**  
  Extracts and displays:
  - **Common Name**
  - **Scientific Name**
  - **Care Requirements** (including water, sunlight, and soil recommendations)
  - **Interesting Facts**
  - **Warnings** (e.g., toxicity or handling precautions)

- **Responsive Design:**  
  Built with Next.js and Tailwind CSS for a modern, responsive, and user-friendly interface.

- **Robust Error Handling:**  
  Provides clear loading states and error messages to ensure a smooth user experience.

## Technologies Used

- **Next.js:** A powerful React framework for building server-side rendered and static web applications.
- **Tailwind CSS:** A utility-first CSS framework that speeds up UI development.
- **Google Generative AI:** Leverages the Gemini model to identify plants and generate care information.
- **React Hooks:** For efficient state management in client-side components.

## Getting Started

### Prerequisites

- **Node.js** (v14 or later)
- **npm** or **Yarn**
- A valid Google API key with access to the Gemini model.  
  Create a `.env` file in the project root and add:
  ```env
  GEMINI_API_KEY=your-google-api-key
