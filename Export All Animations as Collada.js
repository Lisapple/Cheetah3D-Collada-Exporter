// Version 1.0 - Public domain
// @see github.com/lisapple/Chetah3D-Collada-Exporter

function main(doc) {

	var savePath = OS.runSavePanel("dae");
	doc.saveToFile(savePath, "dae");

	var saveDir = (new File(savePath)).directory();
	print("Exported at " + savePath);

	var takes = [];
	var finalMarkup = "";
	for (var i = doc.takeCount()-1; i >= 0 ; --i) {

		// Normalize name before setting take as current
		var takeName = doc.takeAtIndex(i).name;
		//takeName = takeName.replace(/\s+/, "-");
		doc.setCurrentTake(takeName);

		// Export only this take scene with animation as temporary file
		var seed = Math.floor(Math.random()*(1<<30));
		var path = saveDir+"/.export_"+takeName+"-"+seed+".dae";
		doc.saveToFile(path, "dae");

		// Read temporary exported scene
		var file = new File(path);
		file.open(READ_MODE);
		var content = file.read(file.size());

		var ids = []
		// Uniquify the "id" attribute for each take animation
		var regex = /<animation id="([^"]+)" .+>[\s\S]*?<\/animation>/g;
		var match = regex.exec(content);
		while (match != null) {
			var newId = match[1]+'-'+takeName // Just append take name
			ids = ids.concat(newId);

			var markup = match[0].replace(match[1], newId);
			finalMarkup += markup + "\n";

			match = regex.exec(content);
		}
		print("Renaming animations to: " + ids + " for take " + '"'+takeName+'"');

		takes = takes.concat({ name: takeName, length: doc.takeAtIndex(i).length, ids: ids });

		// Clean-up temporary file
		file.close();
		print("rm "+path.replace(/([ \(\)\[\]])/g, '\\$1'));
		OS.system("rm "+path.replace(/([ \(\)\[\]])/g, '\\$1'));
	}

	// Create animation clips markup, as follow:
	// <library_animation_clips>
	//   <animation_clip name="Take-1" start="0.0" end="3.0">
	//     <instance_animation url="#anim-1"/>
	//     <instance_animation url="#anim-2"/>
	//   </animation_clip>
	//   ...
	// </library_animation_clips>

	var clipsContent = "<library_animation_clips>" + "\n";
	for (var i = 0; i < takes.length; ++i) {
		clipsContent += '<animation_clip name="'+takes[i].name+'" start="0.0" end="'+takes[i].length.toFixed(1)+'">' + "\n";

		for (var j = 0; j < takes[i].ids.length; ++j) {
			clipsContent += '	<instance_animation url="#'+takes[i].ids[j]+'"/>' + "\n";
		}
		clipsContent += "</animation_clip>" + "\n";
	}
	clipsContent += "</library_animation_clips>" + "\n";

	// Remplace markup modifications to final file
	var file = new File(savePath);
	file.open(READ_MODE);
	var content = file.read(file.size());
	file.close();

	var finalContent = content;
	var regex = /<animation id="([^"]+)[\s\S]+<\/animation>/;
	var index = content.search(regex);
	if (index != -1) { // Append animation to existing ones
		finalContent = content.replace(regex, finalMarkup);
	} else { // No animations existing, insert them before <library_cameras>
		var regex = /<library_cameras>/;
		var index = content.search(regex);
		var markup = "<library_animations>"+finalMarkup+"</library_animations>";
		finalContent = content.slice(0, index) + markup + content.slice(index);
	}

	var regex = /<library_cameras>/; // Insert clips before <library_cameras>
	var index = finalContent.search(regex);
	finalContent = finalContent.slice(0, index) + clipsContent + finalContent.slice(index);

	// Write to disk
	var file = new File(savePath);
	file.open(WRITE_MODE);
	file.write(finalContent);
	file.close();
}
