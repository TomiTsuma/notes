Tasklist

- [] Make sure the streak functionality in the home page uses actual streak data collected from the db instance

- [] Make sure that all the items in the ToolPalette are functional and that the notes feature is completely functional. (First make sure for each item you list down everything they should be capable of doing then create each of those functionalities)

- [] Test out the functionality to connect to Nextcloud (using credentials configured in .env: NEXTCLOUD_URL, NEXTCLOUD_USERNAME, NEXTCLOUD_PASSWORD)

- [] Implement a file/folder upload feature where when a user uploads a file, it is synced to nextcloud in a path called Chlio (create the path on nextcloud if it does not exist)

- [] Ensure that the paths of files like pdfs is persistent (They should be pushed to nextcloud. If the upload is currently not possible, just hold on to the file locally and setup a background task that will upload the file later)

- [] In the {/* Header Branding */}, in the Sidebar, use the src/assets/logo.png

- [x] The Google calendar sync should use a .ics file

- [x] I should be able to click and open a task in the Kanban section to view details about that task like communications, task descriptions, due dates, priorities etc

- [] Set the url for the AI to be http://localhost:11434 and the model to be gemma4:latest

- [] Make sure the AI chat functionality actually works and that it references the current actively selected paper.

- [] Create a light and dark mode 

